# Builders' Kit Local Guide

Follow these step-by-step instructions to run the Builders' Kit project locally:

1. Prerequisites:
   - Ensure Node.js (v16 or later) and npm (v7 or later) are installed on your system.
   - Docker is required as the Builders' Kit runs in a container.
   - Optionally, install Git to manage your code.

2. Navigate to the Builders' Kit directory:
   - Open your terminal and run:
     ```
     cd node-red-example
     ```

3. Install dependencies:
   - Run the command:
     ```
     npm install
     ```

4. Start the Builders' Kit:
   - The following command will build a Docker image and start the Builders' Kit in a container:
     ```
     npm start
     ```
   - Alternatively, you can run the container directly:
     ```
     docker run -d --name nodered-builder -p 1880:1880 srt0422/nodered-example:latest
     ```
   - This will run the Builders' Kit in a Docker container, exposed on port 1880.
   - Docker will need to be running on your system for this command to succeed.

5. Access the Builders' Kit Interface:
   - Open your browser and go to http://localhost:1880/admin/ to interact with the Node-RED based Builders' Kit.
   - Note: The admin path (/admin/) is required to access the interface.

## Troubleshooting

- If you encounter Docker-related errors, make sure Docker is installed and running on your system.
- If port 1880 is already in use, you may need to modify the scripts/start.sh file to use a different port.
- For macOS users with Apple Silicon, you might see a platform warning. You can add the `--platform linux/arm64` flag to your Docker run command.
- If the container starts but you can't access the interface, make sure you're using the correct URL: http://localhost:1880/admin/

For detailed customization and advanced deployment options, please refer to the Docker configuration in scripts/start.sh.
