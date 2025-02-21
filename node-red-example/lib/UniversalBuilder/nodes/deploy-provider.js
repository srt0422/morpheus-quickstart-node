module.exports = function(RED) {
    function ProviderNode(config) {
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

    RED.nodes.registerType("deploy-provider", ProviderNode, {
        category: "Future Morpheus",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-server",
        label: function() {
            return this.name || "Provider";
        },
        paletteLabel: "Provider"
    });
}