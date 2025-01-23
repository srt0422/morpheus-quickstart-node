module.exports = function(RED) {
    function AgentNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg, send, done) {
            // Pass through execution
            send(msg);
            if (done) {
                done();
            }
        });
    }

    RED.nodes.registerType("deploy-agent", AgentNode, {
        category: "Future Morpheus",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-user-secret",
        label: function() {
            return this.name || "Agent";
        },
        paletteLabel: "Agent"
    });
}