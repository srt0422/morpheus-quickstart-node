module.exports = function(RED) {
    function SubnetNode(config) {
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

    RED.nodes.registerType("deploy-subnet", SubnetNode, {
        category: "Future Blockchain",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-network-wired",
        label: function() {
            return this.name || "Subnet";
        },
        paletteLabel: "Subnet"
    });
}