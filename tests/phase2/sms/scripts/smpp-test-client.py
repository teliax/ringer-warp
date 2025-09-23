#!/usr/bin/env python3
"""
SMPP Test Client for Jasmin SMSC Testing
Supports various test scenarios including MT, MO, DLR, and load testing
"""

import smpplib.client
import smpplib.gsm
import smpplib.consts
import time
import logging
import argparse
import json
import threading
import queue
from datetime import datetime
import random
import string

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SMPPTestClient:
    """SMPP client for testing Jasmin SMSC"""
    
    def __init__(self, host, port, username, password, system_type='test'):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.system_type = system_type
        self.client = None
        self.message_counter = 0
        self.dlr_queue = queue.Queue()
        self.stats = {
            'sent': 0,
            'delivered': 0,
            'failed': 0,
            'dlr_received': 0
        }
    
    def connect(self):
        """Establish SMPP connection"""
        try:
            self.client = smpplib.client.Client(self.host, self.port)
            self.client.connect()
            self.client.bind_transceiver(
                system_id=self.username,
                password=self.password,
                system_type=self.system_type
            )
            logger.info(f"Connected to SMPP server {self.host}:{self.port}")
            
            # Set up message handlers
            self.client.set_message_sent_handler(self.message_sent_handler)
            self.client.set_message_received_handler(self.message_received_handler)
            
            return True
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from SMPP server"""
        if self.client:
            try:
                self.client.unbind()
                self.client.disconnect()
                logger.info("Disconnected from SMPP server")
            except Exception as e:
                logger.error(f"Disconnect error: {e}")
    
    def send_message(self, source, destination, message, 
                    delivery_receipt=True, data_coding=0):
        """Send single SMS message"""
        try:
            # Handle Unicode messages
            if data_coding == 8:  # UCS2
                message = message.encode('utf-16-be')
            
            # Prepare PDU
            pdu = self.client.send_message(
                source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                source_addr=source,
                dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                destination_addr=destination,
                short_message=message,
                data_coding=data_coding,
                registered_delivery=1 if delivery_receipt else 0,
            )
            
            self.message_counter += 1
            self.stats['sent'] += 1
            
            return pdu.sequence
        except Exception as e:
            logger.error(f"Send message error: {e}")
            self.stats['failed'] += 1
            return None
    
    def send_long_message(self, source, destination, message):
        """Send long message (multi-part SMS)"""
        parts = []
        if len(message) > 160:
            # Split message into parts
            max_len = 153  # 160 - 7 bytes for UDH
            parts = [message[i:i+max_len] for i in range(0, len(message), max_len)]
            
            # Generate reference number for this multi-part message
            ref_num = random.randint(0, 255)
            total_parts = len(parts)
            
            for i, part in enumerate(parts):
                # Create UDH for concatenated SMS
                udh = bytes([
                    0x00,  # IEI: Concatenated short messages
                    0x03,  # IEDL: length of data (3 bytes)
                    ref_num,  # Reference number
                    total_parts,  # Total number of parts
                    i + 1  # Current part number
                ])
                
                # Send part with UDH
                pdu = self.client.send_message(
                    source_addr_ton=smpplib.consts.SMPP_TON_INTL,
                    source_addr=source,
                    dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
                    destination_addr=destination,
                    short_message=part.encode(),
                    esm_class=smpplib.consts.SMPP_MSGMODE_FORWARD | 0x40,  # UDH indicator
                    data_coding=0,
                    registered_delivery=1 if i == total_parts - 1 else 0,  # DLR for last part
                )
                
                self.stats['sent'] += 1
                time.sleep(0.1)  # Small delay between parts
        else:
            # Message fits in single SMS
            self.send_message(source, destination, message)
    
    def send_bulk_messages(self, source, destinations, message, rate_per_second=10):
        """Send bulk SMS messages at specified rate"""
        logger.info(f"Sending bulk SMS to {len(destinations)} recipients at {rate_per_second} msg/sec")
        
        interval = 1.0 / rate_per_second
        start_time = time.time()
        
        for dest in destinations:
            self.send_message(source, dest, message)
            
            # Rate limiting
            elapsed = time.time() - start_time
            expected = (self.stats['sent'] - 1) * interval
            if elapsed < expected:
                time.sleep(expected - elapsed)
        
        logger.info(f"Bulk send completed: {self.stats['sent']} messages sent")
    
    def message_sent_handler(self, pdu):
        """Handle message sent confirmation"""
        logger.debug(f"Message sent: sequence={pdu.sequence}, status={pdu.status}")
        if pdu.status == smpplib.consts.SMPP_ESME_ROK:
            self.stats['delivered'] += 1
    
    def message_received_handler(self, pdu):
        """Handle received messages (MO SMS and DLRs)"""
        if hasattr(pdu, 'receipted_message_id'):
            # This is a delivery receipt
            self.handle_delivery_receipt(pdu)
        else:
            # This is an MO message
            self.handle_mo_message(pdu)
    
    def handle_delivery_receipt(self, pdu):
        """Process delivery receipt"""
        self.stats['dlr_received'] += 1
        
        # Parse DLR content
        dlr_data = {
            'message_id': pdu.receipted_message_id,
            'status': pdu.message_state,
            'error_code': getattr(pdu, 'network_error_code', None),
            'timestamp': datetime.now().isoformat()
        }
        
        self.dlr_queue.put(dlr_data)
        logger.info(f"DLR received: {dlr_data}")
    
    def handle_mo_message(self, pdu):
        """Process Mobile Originated message"""
        mo_data = {
            'source': pdu.source_addr,
            'destination': pdu.destination_addr,
            'message': pdu.short_message.decode('utf-8', errors='ignore'),
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"MO message received: {mo_data}")
        
        # Auto-reply for testing
        if 'STOP' not in mo_data['message'].upper():
            reply = f"Auto-reply: Received '{mo_data['message']}'"
            self.send_message(
                mo_data['destination'],
                mo_data['source'],
                reply
            )
    
    def run_connection_test(self):
        """Test SMPP connection with various bind types"""
        logger.info("=== Running Connection Tests ===")
        
        # Test bind transmitter
        client_tx = smpplib.client.Client(self.host, self.port)
        try:
            client_tx.connect()
            client_tx.bind_transmitter(
                system_id=self.username,
                password=self.password
            )
            logger.info("✓ Bind transmitter successful")
            client_tx.unbind()
            client_tx.disconnect()
        except Exception as e:
            logger.error(f"✗ Bind transmitter failed: {e}")
        
        # Test bind receiver
        client_rx = smpplib.client.Client(self.host, self.port)
        try:
            client_rx.connect()
            client_rx.bind_receiver(
                system_id=self.username,
                password=self.password
            )
            logger.info("✓ Bind receiver successful")
            client_rx.unbind()
            client_rx.disconnect()
        except Exception as e:
            logger.error(f"✗ Bind receiver failed: {e}")
        
        # Test invalid credentials
        client_invalid = smpplib.client.Client(self.host, self.port)
        try:
            client_invalid.connect()
            client_invalid.bind_transceiver(
                system_id="invalid_user",
                password="invalid_pass"
            )
            logger.error("✗ Invalid credentials accepted (security issue)")
        except Exception:
            logger.info("✓ Invalid credentials rejected correctly")
        
        return True
    
    def run_message_tests(self, source, destination):
        """Run various message type tests"""
        logger.info("=== Running Message Tests ===")
        
        # Test 1: Simple ASCII message
        logger.info("Test 1: Simple ASCII message")
        self.send_message(source, destination, "Test message from WARP platform")
        time.sleep(2)
        
        # Test 2: Unicode message
        logger.info("Test 2: Unicode message")
        self.send_message(
            source, destination, 
            "Unicode test: émojis 🚀 中文测试", 
            data_coding=8
        )
        time.sleep(2)
        
        # Test 3: Long message
        logger.info("Test 3: Long message (multi-part)")
        long_msg = "This is a very long message that will be split into multiple parts. " * 10
        self.send_long_message(source, destination, long_msg)
        time.sleep(5)
        
        # Test 4: Flash SMS (Class 0)
        logger.info("Test 4: Flash SMS")
        pdu = self.client.send_message(
            source_addr_ton=smpplib.consts.SMPP_TON_INTL,
            source_addr=source,
            dest_addr_ton=smpplib.consts.SMPP_TON_INTL,
            destination_addr=destination,
            short_message=b"Flash message test",
            data_coding=0x10,  # Flash SMS
            registered_delivery=1,
        )
        time.sleep(2)
        
        return True
    
    def run_load_test(self, source, num_messages=1000, rate=100):
        """Run load test"""
        logger.info(f"=== Running Load Test: {num_messages} messages at {rate} msg/sec ===")
        
        # Generate test destinations
        destinations = [f"+1310555{i:04d}" for i in range(2000, 2000 + num_messages)]
        
        # Start statistics thread
        def print_stats():
            while self.stats['sent'] < num_messages:
                logger.info(f"Stats: Sent={self.stats['sent']}, " +
                          f"Delivered={self.stats['delivered']}, " +
                          f"Failed={self.stats['failed']}, " +
                          f"DLRs={self.stats['dlr_received']}")
                time.sleep(5)
        
        stats_thread = threading.Thread(target=print_stats)
        stats_thread.start()
        
        # Send bulk messages
        start_time = time.time()
        self.send_bulk_messages(source, destinations, "Load test message", rate)
        
        # Wait for all DLRs
        logger.info("Waiting for delivery receipts...")
        timeout = 60  # 60 seconds timeout for DLRs
        wait_start = time.time()
        
        while (self.stats['dlr_received'] < self.stats['sent'] and 
               time.time() - wait_start < timeout):
            time.sleep(1)
        
        # Calculate results
        duration = time.time() - start_time
        actual_rate = self.stats['sent'] / duration
        
        logger.info("=== Load Test Results ===")
        logger.info(f"Total messages sent: {self.stats['sent']}")
        logger.info(f"Total delivered: {self.stats['delivered']}")
        logger.info(f"Total failed: {self.stats['failed']}")
        logger.info(f"DLRs received: {self.stats['dlr_received']}")
        logger.info(f"Duration: {duration:.2f} seconds")
        logger.info(f"Actual rate: {actual_rate:.2f} msg/sec")
        logger.info(f"Success rate: {(self.stats['delivered']/self.stats['sent']*100):.2f}%")
        
        return True
    
    def get_stats(self):
        """Get current statistics"""
        return self.stats


def main():
    """Main test execution"""
    parser = argparse.ArgumentParser(description='SMPP Test Client for Jasmin')
    parser.add_argument('--host', default='localhost', help='SMPP host')
    parser.add_argument('--port', type=int, default=2775, help='SMPP port')
    parser.add_argument('--username', default='test_user', help='SMPP username')
    parser.add_argument('--password', default='test_pass', help='SMPP password')
    parser.add_argument('--source', default='+12125551000', help='Source number')
    parser.add_argument('--destination', default='+13105552000', help='Destination number')
    parser.add_argument('--test', choices=['connection', 'message', 'load', 'all'], 
                       default='all', help='Test type to run')
    parser.add_argument('--messages', type=int, default=100, 
                       help='Number of messages for load test')
    parser.add_argument('--rate', type=int, default=10, 
                       help='Messages per second for load test')
    
    args = parser.parse_args()
    
    # Create test client
    client = SMPPTestClient(
        args.host, args.port, 
        args.username, args.password
    )
    
    try:
        # Connect to SMPP server
        if not client.connect():
            logger.error("Failed to connect to SMPP server")
            return 1
        
        # Listen for PDUs in background
        listen_thread = threading.Thread(target=client.client.listen)
        listen_thread.daemon = True
        listen_thread.start()
        
        # Run tests based on selection
        if args.test in ['connection', 'all']:
            client.run_connection_test()
            time.sleep(2)
        
        if args.test in ['message', 'all']:
            client.run_message_tests(args.source, args.destination)
            time.sleep(5)
        
        if args.test in ['load', 'all']:
            client.run_load_test(args.source, args.messages, args.rate)
        
        # Wait for any remaining DLRs
        time.sleep(10)
        
        # Print final statistics
        stats = client.get_stats()
        logger.info("=== Final Statistics ===")
        logger.info(json.dumps(stats, indent=2))
        
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Test error: {e}")
        return 1
    finally:
        client.disconnect()
    
    return 0


if __name__ == '__main__':
    exit(main())