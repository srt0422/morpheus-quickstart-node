const { MockNode } = require('./mock-red');

module.exports = function(RED) {
    class InjectNode extends MockNode {
        constructor(config) {
            super(config);
            this.name = config.name;
            this.props = config.props || [];
            this.repeat = config.repeat;
            this.crontab = config.crontab;
            this.once = config.once;
            this.onceDelay = config.onceDelay;
            this.topic = config.topic;
            this.payload = config.payload;
            this.payloadType = config.payloadType;
        }

        receive(msg) {
            // Simply forward the message
            this.send(msg);
        }
    }

    RED.nodes.registerType("inject", InjectNode, {
        category: 'common',
        color: '#a6bbcf',
        defaults: {
            name: { value: "" },
            props: { value: [] },
            repeat: { value: "" },
            crontab: { value: "" },
            once: { value: false },
            onceDelay: { value: 0.1 },
            topic: { value: "" },
            payload: { value: "" },
            payloadType: { value: "date" }
        },
        inputs: 0,
        outputs: 1,
        icon: "inject.svg",
        label: function() {
            return this.name || "inject";
        }
    });

    return InjectNode;
}; 