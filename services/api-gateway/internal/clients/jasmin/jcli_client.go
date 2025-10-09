package jasmin

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"strings"
	"time"
)

// JCliClient manages connections to Jasmin's jCli interface
type JCliClient struct {
	host     string
	port     int
	password string
	timeout  time.Duration
}

// NewJCliClient creates a new Jasmin jCli client
func NewJCliClient(host string, port int, password string) *JCliClient {
	return &JCliClient{
		host:     host,
		port:     port,
		password: password,
		timeout:  10 * time.Second,
	}
}

// SMPPConnector represents an SMPP connector configuration
type SMPPConnector struct {
	CID              string
	Host             string
	Port             int
	SSL              bool
	Username         string // Empty for IP-based auth
	Password         string // Empty for IP-based auth
	BindType         string // "transceiver", "transmitter", "receiver"
	SubmitThroughput int
	Priority         int
}

// CreateSMPPConnector creates a new SMPP connector in Jasmin
func (c *JCliClient) CreateSMPPConnector(connector *SMPPConnector) error {
	log.Printf("[jCli] Creating SMPP connector: %s", connector.CID)

	conn, err := c.connect()
	if err != nil {
		log.Printf("[jCli] Connection failed: %v", err)
		return fmt.Errorf("failed to connect to jCli: %w", err)
	}
	defer conn.Close()

	log.Printf("[jCli] Connected to %s:%d", c.host, c.port)

	reader := bufio.NewReader(conn)

	// Authenticate
	log.Printf("[jCli] Authenticating...")
	if err := c.authenticate(conn, reader); err != nil {
		log.Printf("[jCli] Authentication failed: %v", err)
		return fmt.Errorf("authentication failed: %w", err)
	}
	log.Printf("[jCli] Authenticated successfully")

	// Send commands to create SMPP connector
	commands := []string{
		"smppccm -a",
		fmt.Sprintf("cid %s", connector.CID),
		fmt.Sprintf("host %s", connector.Host),
		fmt.Sprintf("port %d", connector.Port),
	}

	// Add SSL if enabled
	if connector.SSL {
		commands = append(commands, "ssl yes")
	} else {
		commands = append(commands, "ssl no")
	}

	// Add credentials only if provided (not needed for IP-based auth)
	if connector.Username != "" {
		commands = append(commands, fmt.Sprintf("username %s", connector.Username))
	}
	if connector.Password != "" {
		commands = append(commands, fmt.Sprintf("password %s", connector.Password))
	}

	// Add bind configuration
	commands = append(commands,
		fmt.Sprintf("bind %s", connector.BindType),
		fmt.Sprintf("submit_throughput %d", connector.SubmitThroughput),
		"ok",
	)

	// Execute commands
	for i, cmd := range commands {
		log.Printf("[jCli] Sending command %d/%d: %s", i+1, len(commands), cmd)
		if err := c.sendCommand(conn, reader, cmd); err != nil {
			log.Printf("[jCli] Command failed: %s, error: %v", cmd, err)
			return fmt.Errorf("command '%s' failed: %w", cmd, err)
		}
		log.Printf("[jCli] Command %d completed successfully", i+1)
	}

	// CRITICAL: Persist configuration to disk
	log.Printf("[jCli] Persisting configuration to disk...")
	if err := c.sendCommand(conn, reader, "persist"); err != nil {
		log.Printf("[jCli] Persist failed (non-fatal): %v", err)
		// Don't fail - connector is created, just not persisted
	} else {
		log.Printf("[jCli] Configuration persisted to /etc/jasmin/store/")
	}

	log.Printf("[jCli] SMPP connector %s created successfully", connector.CID)
	return nil
}

// StartConnector starts an SMPP connector
func (c *JCliClient) StartConnector(cid string) error {
	conn, err := c.connect()
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	if err := c.authenticate(conn, reader); err != nil {
		return err
	}

	// Start connector: smppccm -1 <cid>
	cmd := fmt.Sprintf("smppccm -1 %s", cid)
	return c.sendCommand(conn, reader, cmd)
}

// StopConnector stops an SMPP connector
func (c *JCliClient) StopConnector(cid string) error {
	conn, err := c.connect()
	if err != nil {
		return err
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	if err := c.authenticate(conn, reader); err != nil {
		return err
	}

	// Stop connector: smppccm -0 <cid>
	cmd := fmt.Sprintf("smppccm -0 %s", cid)
	return c.sendCommand(conn, reader, cmd)
}

// ListConnectors lists all SMPP connectors
func (c *JCliClient) ListConnectors() (string, error) {
	conn, err := c.connect()
	if err != nil {
		return "", err
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	if err := c.authenticate(conn, reader); err != nil {
		return "", err
	}

	// List connectors
	if err := c.sendCommand(conn, reader, "smppccm -l"); err != nil {
		return "", err
	}

	// Read response
	var output strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		output.WriteString(line)
		if strings.Contains(line, "jcli :") {
			break
		}
	}

	return output.String(), nil
}

// GetConnectorStatus gets the status of SMPP connectors
func (c *JCliClient) GetConnectorStatus() (string, error) {
	conn, err := c.connect()
	if err != nil {
		return "", err
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	if err := c.authenticate(conn, reader); err != nil {
		return "", err
	}

	if err := c.sendCommand(conn, reader, "smppccm -s"); err != nil {
		return "", err
	}

	// Read status response
	var output strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		output.WriteString(line)
		if strings.Contains(line, "jcli :") {
			break
		}
	}

	return output.String(), nil
}

// connect establishes a telnet connection to jCli
func (c *JCliClient) connect() (net.Conn, error) {
	address := fmt.Sprintf("%s:%d", c.host, c.port)
	conn, err := net.DialTimeout("tcp", address, c.timeout)
	if err != nil {
		return nil, fmt.Errorf("dial failed: %w", err)
	}
	return conn, nil
}

// authenticate sends password to jCli
func (c *JCliClient) authenticate(conn net.Conn, reader *bufio.Reader) error {
	log.Printf("[jCli] Reading welcome/prompt...")

	// jCli sends welcome message then prompt WITHOUT newline
	// Read for 1 second and check what we got
	time.Sleep(500 * time.Millisecond)

	// Read all available data
	buf := make([]byte, 4096)
	n, err := reader.Read(buf)
	if err != nil && n == 0 {
		log.Printf("[jCli] Read error: %v", err)
		return err
	}

	data := string(buf[:n])
	log.Printf("[jCli] Received %d bytes: %q", n, data)

	// Check for prompt
	if strings.Contains(data, "jcli :") || strings.Contains(data, "Session ref") {
		log.Printf("[jCli] Found jCli session, ready for commands")
		return nil
	}

	log.Printf("[jCli] No prompt found in response")
	return fmt.Errorf("unexpected jCli response")
}

// sendCommand sends a command and waits for response
func (c *JCliClient) sendCommand(conn net.Conn, reader *bufio.Reader, cmd string) error {
	log.Printf("[jCli] Sending: %s", cmd)

	// Send command
	_, err := conn.Write([]byte(cmd + "\n"))
	if err != nil {
		log.Printf("[jCli] Write error: %v", err)
		return err
	}

	// Read response (wait for prompt) with timeout
	timeout := time.After(5 * time.Second)
	done := make(chan error, 1)

	go func() {
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				done <- err
				return
			}

			log.Printf("[jCli] Response: %s", strings.TrimSpace(line))

			// Check for errors
			if strings.Contains(line, "Unknown") || strings.Contains(line, "Error") || strings.Contains(line, "Failed") {
				done <- fmt.Errorf("command failed: %s", strings.TrimSpace(line))
				return
			}

			// Success indicators - jCli is ready for next command
			if strings.Contains(line, "Successfully") ||
			   strings.Contains(line, "> ") ||
			   strings.Contains(line, "jcli :") ||
			   strings.Contains(line, "Adding a new connector") ||
			   strings.Contains(line, "ok: save") {
				done <- nil
				return
			}
		}
	}()

	select {
	case err := <-done:
		return err
	case <-timeout:
		log.Printf("[jCli] Command timeout after 5s")
		return fmt.Errorf("command timeout")
	}
}
