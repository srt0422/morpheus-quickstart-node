module.exports = function(RED) {
    function CloudLocalNode(config) {
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
    RED.nodes.registerType("deploy-cloud-local", CloudLocalNode);
}