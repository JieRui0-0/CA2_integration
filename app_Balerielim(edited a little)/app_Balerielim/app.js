const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Middleware Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
    secret: 'secretkey123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

app.use(flash());

// Database Connection
const db = mysql.createConnection({
    host: 'auop8m.h.filess.io',
    port: 3307,
    user: 'C237test_besidewent',
    password: '755e1c4413e8fcc516b222b8a65a6fba05d2968c',
    database: 'C237test_besidewent'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Middleware
const checkAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Please log in first.');
        return res.redirect('/login');
    }
    next();
};

const checkAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Access denied');
        return res.redirect('/dashboard');
    }
    next();
};

// Home
app.get('/', (req, res) => {
    res.render('index', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

// Register
app.get('/register', (req, res) => {
    res.render('register', {
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});

app.post('/register', (req, res) => {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password || !role) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/register');
    }

    const checkSql = 'SELECT * FROM users WHERE email = ?';
    db.query(checkSql, [email], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Database error, please try again.');
            return res.redirect('/register');
        }

        if (result.length > 0) {
            req.flash('error', 'Email already exists.');
            return res.redirect('/register');
        }

        const insertSql = 'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, SHA1(?), ?)';
        db.query(insertSql, [name, username, email, password, role], (err) => {
            if (err) {
                console.error('Database error:', err);
                req.flash('error', 'Registration failed. Please try again.');
                return res.redirect('/register');
            }
            req.flash('success', 'Registered successfully! Please log in.');
            res.redirect('/login');
        });
    });
});

// Login
app.get('/login', (req, res) => {
    res.render('login', {
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Database error, please try again.');
            return res.redirect('/login');
        }

        if (results.length === 0) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        req.session.user = results[0];
        req.flash('success', 'Logged in successfully!');
        return res.redirect(results[0].role === 'admin' ? '/admin' : '/dashboard');
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Dashboards
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', {
        user: req.session.user,
        messages: req.flash('success')
    });
});

// Leaderboard View
app.get('/leaderboard', (req, res) => {
    db.query('SELECT * FROM leaderboard ORDER BY points DESC', (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Failed to load leaderboard.');
            return res.redirect('/');
        }
        res.render('leaderboard', {
            leaderboard: rows,
            messages: req.flash('success'),
            errors: req.flash('error'),
            user: req.session.user || null
        });
    });
});

// Search leaderboard
app.get('/leaderboard/search', (req, res) => {
    const { user_id } = req.query;

    let query = 'SELECT * FROM leaderboard WHERE 1=1';
    const params = [];

    if (user_id) {
        query += ' AND user_id LIKE ?';
        params.push(`%${user_id}%`);
    }

    query += ' ORDER BY points DESC';

    db.query(query, params, (err, rows) => {
        if (err) {
            req.flash('error', 'Search failed.');
            return res.redirect('/leaderboard');
        }
        res.render('leaderboard', {
            leaderboard: rows,
            messages: req.flash('success'),
            errors: req.flash('error'),
            user: req.session.user || null
        });
    });
});

// =========================
// Leaderboard Add/Edit (Admin Only)
// =========================

// Show Add Form
app.get('/leaderboard/add', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('leaderboard_form', {
        user: req.session.user,
        data: null,
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// Handle Add Submission
app.post('/leaderboard/add', checkAuthenticated, checkAdmin, (req, res) => {
    const { user_id, points, achievements } = req.body;

    if (!user_id || !points) {
        req.flash('error', 'User ID and points are required.');
        return res.redirect('/leaderboard/add');
    }

    const sql = 'INSERT INTO leaderboard (user_id, points, achievements, last_updated) VALUES (?, ?, ?, NOW())';
    db.query(sql, [user_id, points, achievements], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to add leaderboard entry.');
            return res.redirect('/leaderboard');
        }
        req.flash('success', 'Leaderboard entry added successfully.');
        res.redirect('/leaderboard');
    });
});

// Show Edit Form
app.get('/leaderboard/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM leaderboard WHERE id = ?';
    db.query(sql, [req.params.id], (err, rows) => {
        if (err || rows.length === 0) {
            req.flash('error', 'Entry not found.');
            return res.redirect('/leaderboard');
        }
        res.render('leaderboard_form', {
            user: req.session.user,
            data: rows[0],
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// Handle Edit Submission
app.post('/leaderboard/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const { points, achievements } = req.body;

    if (!points) {
        req.flash('error', 'Points are required.');
        return res.redirect(`/leaderboard/edit/${req.params.id}`);
    }

    const sql = 'UPDATE leaderboard SET points = ?, achievements = ?, last_updated = NOW() WHERE id = ?';
    db.query(sql, [points, achievements, req.params.id], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to update leaderboard entry.');
            return res.redirect('/leaderboard');
        }
        req.flash('success', 'Leaderboard entry updated successfully.');
        res.redirect('/leaderboard');
    });
});

// =========================
// Contact Submissions
// =========================

// Contact Form (Require Login)
app.get('/contact', checkAuthenticated, (req, res) => {
    res.render('contact', {
        messages: req.flash('success'),
        errors: req.flash('error'),
        user: req.session.user,
        submissions: [],
        search: ''
    });
});

// Handle Contact Form Submission (Require Login)
app.post('/contact', checkAuthenticated, (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/contact');
    }

    const sql = 'INSERT INTO contact_submissions (name, email, subject, message) VALUES (?, ?, ?, ?)';
    db.query(sql, [name, email, subject, message], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to submit contact form.');
            return res.redirect('/contact');
        }
        req.flash('success', 'Your message has been submitted successfully.');
        res.redirect('/contact');
    });
});

// Admin: View/Search Submissions
app.get('/contact/submissions', checkAuthenticated, checkAdmin, (req, res) => {
    const search = req.query.search || '';

    let query = 'SELECT * FROM contact_submissions';
    const params = [];

    if (search) {
        query += ' WHERE name LIKE ? OR subject LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC';

    db.query(query, params, (err, rows) => {
        if (err) {
            req.flash('error', 'Failed to load submissions.');
            return res.redirect('/admin');
        }
        res.render('contact', {
            submissions: rows,
            search,
            messages: req.flash('success'),
            errors: req.flash('error'),
            user: req.session.user
        });
    });
});

// Admin: Delete Submission
app.get('/contact/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('DELETE FROM contact_submissions WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            req.flash('error', 'Failed to delete submission.');
            return res.redirect('/contact/submissions');
        }
        req.flash('success', 'Submission deleted.');
        res.redirect('/contact/submissions');
    });
});

// Server Start
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
