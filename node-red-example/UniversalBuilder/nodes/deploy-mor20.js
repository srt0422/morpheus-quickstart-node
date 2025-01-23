module.exports = function(RED) {
    function MOR20Node(config) {
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

    RED.nodes.registerType("deploy-mor20", MOR20Node, {
        category: "Future Blockchain",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-coins",
        label: function() {
            return this.name || "MOR20";
        },
        paletteLabel: "MOR20"
    });
}