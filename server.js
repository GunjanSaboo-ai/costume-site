const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// ==================== LOGGING ====================
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
});

// ==================== JSON DATABASE ====================
const JSON_DATA_FILE = './database/data.json';

if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database');
}

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
    console.log('📄 Created new data file:', JSON_DATA_FILE);
}

function readJsonData() {
    try {
        const raw = fs.readFileSync(JSON_DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Error reading data:', err);
        return { inventory: [], orders: [], featured: [], schools: [] };
    }
}

function writeJsonData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(JSON_DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing data:', err);
        return false;
    }
}

// ==================== LOCATION MASTER ====================
const LOCATION_FILE = './database/locations.json';

let locationMaster = {};
if (fs.existsSync(LOCATION_FILE)) {
    try {
        const raw = fs.readFileSync(LOCATION_FILE, 'utf8');
        locationMaster = JSON.parse(raw);
        console.log(`✅ Location master loaded: ${Object.keys(locationMaster).length} locations`);
        // Show first 3 locations as sample
        const sample = Object.keys(locationMaster).slice(0, 3);
        sample.forEach(key => {
            console.log(`   ${key} → ${locationMaster[key].fullAddress}`);
        });
    } catch (err) {
        console.error('❌ Error loading location master:', err.message);
    }
} else {
    console.log('⚠️ Location master not found at:', LOCATION_FILE);
}

// ==================== API: TEST ====================
app.get('/api/test', (req, res) => {
    const data = readJsonData();
    res.json({
        success: true,
        message: 'Server is running!',
        dataFile: JSON_DATA_FILE,
        inventoryCount: data.inventory.length,
        ordersCount: data.orders.length,
        schoolsCount: data.schools.length,
        locationsCount: Object.keys(locationMaster).length
    });
});

// ==================== API: LOCATION ====================
app.get('/api/location/:locCode', (req, res) => {
    console.log('🔍 Location lookup:', req.params.locCode);
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

// ==================== API: INVENTORY ====================
app.get('/api/inventory', (req, res) => {
    const data = readJsonData();
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
    const data = readJsonData();
    data.inventory = inventory;
    data.lastUpdated = new Date().toISOString();
    writeJsonData(data);
    res.json({ success: true, message: `Imported ${inventory.length} designs` });
});

// ==================== API: ORDERS ====================
app.post('/api/orders', (req, res) => {
    const order = req.body;
    const orderId = 'ORD-' + Date.now();
    const data = readJsonData();
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
    writeJsonData(data);
    res.json({ success: true, orderId: orderId, message: 'Order placed successfully' });
});

app.get('/api/orders', (req, res) => {
    const data = readJsonData();
    res.json(data.orders.reverse());
});

app.put('/api/orders/:orderId', (req, res) => {
    const { status } = req.body;
    const orderId = req.params.orderId;
    const data = readJsonData();
    const order = data.orders.find(o => o.orderId === orderId);
    if (order) {
        order.status = status;
        writeJsonData(data);
        res.json({ success: true, message: 'Order updated' });
    } else {
        res.status(404).json({ error: 'Order not found' });
    }
});

// ==================== API: FEATURED ====================
app.get('/api/featured', (req, res) => {
    const data = readJsonData();
    res.json(data.featured || []);
});

app.post('/api/featured', (req, res) => {
    const { featured } = req.body;
    const data = readJsonData();
    data.featured = featured;
    writeJsonData(data);
    res.json({ success: true, message: 'Featured designs saved' });
});

// ==================== API: SCHOOLS ====================
app.post('/api/schools/register', (req, res) => {
    const { schoolName, email, phone, address, password } = req.body;
    const data = readJsonData();
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
    writeJsonData(data);
    res.json({ success: true, message: 'School registered successfully' });
});

app.post('/api/schools/login', (req, res) => {
    const { email, password } = req.body;
    const data = readJsonData();
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
    const data = readJsonData();
    res.json(data.schools.filter(s => s.role !== 'admin'));
});

// ==================== API: ROUTES (DEBUG) ====================
app.get('/api/routes', (req, res) => {
    res.json({
        success: true,
        message: 'Available routes:',
        routes: [
            '/api/test',
            '/api/location/:locCode',
            '/api/locations',
            '/api/inventory',
            '/api/orders',
            '/api/featured',
            '/api/schools',
            '/api/schools/login',
            '/api/schools/register',
            '/api/routes'
        ]
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   🎭 COSTUME STORE SERVER RUNNING                                 ║
    ║   (Using JSON File Database + Location Master)                    ║
    ║                                                                   ║
    ║   📍 http://localhost:${PORT}                                       ║
    ║   📂 Data file: ${JSON_DATA_FILE}                                  ║
    ║   🗺️  Locations: ${Object.keys(locationMaster).length} bins          ║
    ║   ✅ Server is ready                                              ║
    ║                                                                   ║
    ║   🖥️  Test: http://localhost:${PORT}/api/test                       ║
    ║   🖥️  Routes: http://localhost:${PORT}/api/routes                    ║
    ║   🖥️  Location: http://localhost:${PORT}/api/location/9000000001     ║
    ║                                                                   ║
    ╚═══════════════════════════════════════════════════════════════════╝
    `);
});