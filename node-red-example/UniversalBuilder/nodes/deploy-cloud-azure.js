module.exports = function(RED) {
    function CloudAzureNode(config) {
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
    RED.nodes.registerType("deploy-cloud-azure", CloudAzureNode, {
        category: "Future Cloud",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-cloud",
        label: function() {
            return this.name || "Azure";
        },
        paletteLabel: "Azure"
    });
}