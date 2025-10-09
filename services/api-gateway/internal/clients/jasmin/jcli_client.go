package jasmin

import (
	"bufio"
	"fmt"
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
	conn, err := c.connect()
	if err != nil {
		return fmt.Errorf("failed to connect to jCli: %w", err)
	}
	defer conn.Close()

	reader := bufio.NewReader(conn)

	// Authenticate
	if err := c.authenticate(conn, reader); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

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
	for _, cmd := range commands {
		if err := c.sendCommand(conn, reader, cmd); err != nil {
			return fmt.Errorf("command '%s' failed: %w", cmd, err)
		}
	}

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
	// Wait for password prompt
	prompt, err := reader.ReadString('\n')
	if err != nil {
		return err
	}

	if !strings.Contains(prompt, "Authentication required") && !strings.Contains(prompt, "Password") {
		// Already authenticated or no auth required
		return nil
	}

	// Send password
	_, err = conn.Write([]byte(c.password + "\n"))
	if err != nil {
		return err
	}

	// Read authentication result
	result, err := reader.ReadString('\n')
	if err != nil {
		return err
	}

	if strings.Contains(result, "Authentication failed") {
		return fmt.Errorf("authentication failed")
	}

	return nil
}

// sendCommand sends a command and waits for response
func (c *JCliClient) sendCommand(conn net.Conn, reader *bufio.Reader, cmd string) error {
	// Send command
	_, err := conn.Write([]byte(cmd + "\n"))
	if err != nil {
		return err
	}

	// Read response (wait for prompt)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}

		// Check for errors
		if strings.Contains(line, "Unknown") || strings.Contains(line, "Error") || strings.Contains(line, "Failed") {
			return fmt.Errorf("command failed: %s", strings.TrimSpace(line))
		}

		// Success indicators
		if strings.Contains(line, "Successfully") || strings.Contains(line, "> ") || strings.Contains(line, "jcli :") {
			break
		}
	}

	return nil
}
