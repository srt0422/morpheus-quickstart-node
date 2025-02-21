module.exports = function(RED) {
    function WalletNode(config) {
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

    RED.nodes.registerType("deploy-wallet", WalletNode, {
        category: "Future Blockchain",
        color: "#4363d8",
        defaults: {
            name: { value: "" }
        },
        inputs: 1,
        outputs: 1,
        icon: "font-awesome/fa-wallet",
        label: function() {
            return this.name || "Wallet";
        },
        paletteLabel: "Wallet"
    });
}