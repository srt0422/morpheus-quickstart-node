module.exports = function(RED) {
    function AppNode(config) {
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

    RED.nodes.registerType("deploy-app", AppNode, {
        category: "Future",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-cube",
        label: function() {
            return this.name || "App";
        },
        paletteLabel: "App"
    });
}