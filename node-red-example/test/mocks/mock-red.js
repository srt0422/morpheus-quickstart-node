class MockNode {
    constructor(config) {
        this.id = config.id;
        this.type = config.type;
        this.name = config.name || '';
        this._closeCallbacks = [];
        this._inputCallback = null;
        this.wires = config.wires || [];
        this.status = () => {};
        this.error = (err) => { console.error(err); };
        this.debug = (msg) => { console.debug(msg); };
        this.warn = (msg) => { console.warn(msg); };
        this.metric = () => {};
        this.send = (msg) => {
            if (Array.isArray(this.wires) && this.wires.length > 0) {
                this.wires.forEach(wire => {
                    if (Array.isArray(wire)) {
                        wire.forEach(nodeId => {
                            const node = this._registry.getNode(nodeId);
                            if (node && node.receive) {
                                node.receive(msg);
                            }
                        });
                    }
                });
            }
            if (this._inputCallback) {
                this._inputCallback(msg);
            }
        };
    }

    on(event, callback) {
        if (event === 'input') {
            this._inputCallback = callback;
        } else if (event === 'close') {
            this._closeCallbacks.push(callback);
        }
    }

    close() {
        this._closeCallbacks.forEach(cb => cb());
    }

    receive(msg) {
        if (this._inputCallback) {
            this._inputCallback(msg);
        }
    }
}

class MockNodeRegistry {
    constructor() {
        this.nodes = new Map();
        this.nodeTypes = new Map();
    }

    registerType(type, constructorOrFactory, definition = {}) {
        this.nodeTypes.set(type, {
            constructor: constructorOrFactory.name,
            factory: constructorOrFactory,
            definition: {
                ...definition,
                name: type
            }
        });
    }

    getType(type) {
        return this.nodeTypes.get(type) || null;
    }

    createNode(node, config) {
        this.nodes.set(config.id, node);
    }

    getNode(id) {
        return this.nodes.get(id);
    }

    clear() {
        this.nodes.clear();
        this.nodeTypes.clear();
    }
}

class MockRED {
    constructor() {
        this.nodes = new MockNodeRegistry();
        this.settings = {
            functionGlobalContext: {},
            get: (key) => this.settings[key]
        };
    }
}

module.exports = {
    MockRED,
    MockNode,
    MockNodeRegistry
}; 