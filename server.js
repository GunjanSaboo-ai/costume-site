const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// ==================== DATA FILES ====================
const JSON_DATA_FILE = './database/data.json';
const LOCATION_FILE = './database/locations.json';

// Create database folder if needed
if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database');
}

// Create data file if needed
if (!fs.existsSync(JSON_DATA_FILE)) {
    const initialData = {
        inventory: [],
        orders: [],
        featured: [],
        schools: [
            {
                id: "admin",
                schoolName: "Admin",
                email: "admin@costumestore.com",
                phone: "9876543210",
                address: "Admin Office",
                password: "admin123",
                role: "admin",
                registeredDate: new Date().toISOString()
            }
        ],
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(JSON_DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('📄 Created data file');
}

function readData() {
    try {
        return JSON.parse(fs.readFileSync(JSON_DATA_FILE, 'utf8'));
    } catch (err) {
        return { inventory: [], orders: [], featured: [], schools: [] };
    }
}

function writeData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(JSON_DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        return false;
    }
}

// ==================== LOCATION MASTER ====================
let locationMaster = {};
if (fs.existsSync(LOCATION_FILE)) {
    try {
        const raw = fs.readFileSync(LOCATION_FILE, 'utf8');
        locationMaster = JSON.parse(raw);
        console.log(`✅ Location master loaded: ${Object.keys(locationMaster).length} locations`);
    } catch (err) {
        console.log('⚠️ Error loading locations:', err.message);
    }
} else {
    console.log('⚠️ locations.json not found');
}

// ==================== ROUTES ====================

// Root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Test route
app.get('/api/test', (req, res) => {
    const data = readData();
    res.json({
        success: true,
        message: 'Server is running!',
        inventoryCount: data.inventory.length,
        ordersCount: data.orders.length,
        schoolsCount: data.schools.length,
        locationsCount: Object.keys(locationMaster).length
    });
});

// Location routes
app.get('/api/location/:locCode', (req, res) => {
    const locCode = req.params.locCode;
    if (locationMaster[locCode]) {
        res.json({
            success: true,
            locCode: locCode,
            location: locationMaster[locCode]
        });
    } else {
        res.json({
            success: false,
            locCode: locCode,
            message: 'Location not found'
        });
    }
});

app.get('/api/locations', (req, res) => {
    res.json({
        success: true,
        total: Object.keys(locationMaster).length,
        locations: locationMaster
    });
});

// Inventory routes
app.get('/api/inventory', (req, res) => {
    const data = readData();
    res.json({
        success: true,
        totalDesigns: data.inventory.length,
        data: data.inventory,
        lastUpdated: data.lastUpdated
    });
});

app.post('/api/inventory/import', (req, res) => {
    const inventory = req.body;
    if (!inventory || !Array.isArray(inventory)) {
        res.status(400).json({ error: 'Invalid inventory data' });
        return;
    }
    const data = readData();
    data.inventory = inventory;
    data.lastUpdated = new Date().toISOString();
    writeData(data);
    res.json({ success: true, message: `Imported ${inventory.length} designs` });
});

// Orders routes
app.post('/api/orders', (req, res) => {
    const order = req.body;
    const orderId = 'ORD-' + Date.now();
    const data = readData();
    data.orders.push({
        orderId: orderId,
        schoolName: order.schoolName,
        schoolEmail: order.schoolEmail,
        phone: order.phone || '',
        address: order.address || '',
        orderDate: new Date().toISOString(),
        items: order.items,
        totalItems: order.totalItems,
        status: 'pending',
        placedByAdmin: order.placedByAdmin || false
    });
    writeData(data);
    res.json({ success: true, orderId: orderId, message: 'Order placed successfully' });
});

app.get('/api/orders', (req, res) => {
    const data = readData();
    res.json(data.orders.reverse());
});

app.put('/api/orders/:orderId', (req, res) => {
    const { status } = req.body;
    const orderId = req.params.orderId;
    const data = readData();
    const order = data.orders.find(o => o.orderId === orderId);
    if (order) {
        order.status = status;
        writeData(data);
        res.json({ success: true, message: 'Order updated' });
    } else {
        res.status(404).json({ error: 'Order not found' });
    }
});

// Featured routes
app.get('/api/featured', (req, res) => {
    const data = readData();
    res.json(data.featured || []);
});

app.post('/api/featured', (req, res) => {
    const { featured } = req.body;
    const data = readData();
    data.featured = featured;
    writeData(data);
    res.json({ success: true, message: 'Featured designs saved' });
});

// Schools routes
app.post('/api/schools/register', (req, res) => {
    const { schoolName, email, phone, address, password } = req.body;
    const data = readData();
    if (data.schools.some(s => s.email === email)) {
        res.status(400).json({ error: 'Email already registered' });
        return;
    }
    data.schools.push({
        id: 'SCH' + Date.now(),
        schoolName: schoolName,
        email: email,
        phone: phone || '',
        address: address || '',
        password: password,
        role: 'school',
        registeredDate: new Date().toISOString()
    });
    writeData(data);
    res.json({ success: true, message: 'School registered successfully' });
});

app.post('/api/schools/login', (req, res) => {
    const { email, password } = req.body;
    const data = readData();
    const school = data.schools.find(s => s.email === email && s.password === password);
    if (school) {
        res.json({
            success: true,
            school: {
                id: school.id,
                schoolName: school.schoolName,
                email: school.email,
                phone: school.phone,
                address: school.address,
                role: school.role
            }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.get('/api/schools', (req, res) => {
    const data = readData();
    res.json(data.schools.filter(s => s.role !== 'admin'));
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   🎭 COSTUME STORE SERVER RUNNING                                 ║
    ║                                                                   ║
    ║   📍 http://0.0.0.0:${PORT}                                         ║
    ║   🗺️  ${Object.keys(locationMaster).length} locations loaded          ║
    ║   ✅ Server is ready                                              ║
    ║                                                                   ║
    ║   🖥️  Test: https://costume-site.onrender.com/api/test             ║
    ║   🖥️  Inventory: https://costume-site.onrender.com/api/inventory   ║
    ║                                                                   ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});