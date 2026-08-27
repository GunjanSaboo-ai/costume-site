const express = require('express');
const app = express();
const PORT = 3000;

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Test server is working!',
        time: new Date().toLocaleString()
    });
});

// Location test route
app.get('/api/location/:locCode', (req, res) => {
    const locCode = req.params.locCode;
    res.json({
        success: true,
        locCode: locCode,
        location: {
            aisle: 'A',
            shelf: 'Top Shelf',
            rack: '1',
            position: '1',
            fullAddress: 'Rack 1, Shelf A (Top Shelf), Position 1'
        }
    });
});

console.log('🚀 Starting test server...');

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║   🧪 TEST SERVER RUNNING                                         ║
    ║   📍 http://localhost:${PORT}                                       ║
    ║   🖥️  Test: http://localhost:${PORT}/api/test                       ║
    ║   🖥️  Location: http://localhost:${PORT}/api/location/9000000001     ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});