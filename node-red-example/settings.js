const path = require('path');

module.exports = {
    uiPort: process.env.PORT || 1880,
    uiHost: "0.0.0.0",
    flowFile: 'flows.json',
    userDir: './data',
    nodesDir: [
        path.join(__dirname, 'UniversalBuilder/nodes')
    ],
    credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || "a-secret-key",
    functionGlobalContext: {
        // Add environment variables to global context
        env: process.env
    },
    httpAdminRoot: '/admin',
    httpStatic: [
        { path: './public', root: "/admin" },
        { path: './lib', root: "/admin/lib" },
        { path: './css', root: "/admin/css" }
    ],
    httpNodeRoot: '/',
    editor: {
        paletteCategories: [ 'Morpheus', 'Future', 'subflows', 'common', 'function', 'network', 'sequence', 'parser', 'storage'],
    },
    editorTheme: {
        projects: {
            enabled: false
        },
        palette: {
            categories: [
                'Morpheus',
                'Future Morpheus',
                'Future Blockchain',
                'Future Cloud',
                'Future'
            ]
        },
        header: {
            title: "Morpheus",
            image: path.join(__dirname, "public/logo.png")
        },
        page: {
            scripts: [],
            style: "/admin/css/custom.css"
        }
    },
    logging: {
        console: {
            level: process.env.LOG_LEVEL || "info",
            metrics: false,
            audit: false
        }
    },
    // Security settings
    adminAuth: process.env.NODE_ENV === 'production' ? {
        type: "credentials",
        users: [{
            username: process.env.NODE_RED_USERNAME || "admin",
            password: process.env.NODE_RED_PASSWORD || "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.",
            permissions: "*"
        }]
    } : null
};
