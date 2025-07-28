const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const app = express();

// Database connection (pooled for stability)
const db = mysql.createPool({
    host: 'auop8m.h.filess.io',
    port: 3307,
    user: 'C237test_besidewent',
    password: '755e1c4413e8fcc516b222b8a65a6fba05d2968c',
    database: 'C237test_besidewent'
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());
app.set('view engine', 'ejs');

// Auth middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
};

// Home route
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

// Register
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/register', (req, res) => {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password || !role) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/register');
    }

    // Check for duplicate email
    const checkUserSql = 'SELECT email FROM users WHERE email = ?';
    db.query(checkUserSql, [email], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Database error: ' + err.message);
            return res.redirect('/register');
        }
        if (result.length > 0) {
            req.flash('error', 'Email already registered.');
            return res.redirect('/register');
        }

        const sql = 'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, SHA1(?), ?)';
        db.query(sql, [name, username, email, password, role], (err) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Database error: ' + err.message);
                return res.redirect('/register');
            }
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    });
});

// Login
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
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
            console.error('DB error:', err.message);
            req.flash('error', 'Unable to connect to database.');
            return res.redirect('/login');
        }

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Dashboard: Show all posts
app.get('/dashboard', checkAuthenticated, (req, res) => {
    const sql = `
        SELECT p.id, p.title, p.content, u.username AS author, p.created_at
        FROM community_posts p
        JOIN users u ON p.author_id = u.id
        ORDER BY p.created_at DESC
    `;

    db.query(sql, (err, posts) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Database error: ' + err.message);
            return res.redirect('/');
        }
        res.render('dashboard', { user: req.session.user, posts });
    });
});

// Create new post
app.get('/post', checkAuthenticated, (req, res) => {
    res.render('create_post', { user: req.session.user });
});

app.post('/post', checkAuthenticated, (req, res) => {
    const { title, content } = req.body;
    const authorId = req.session.user.id;

    const sql = 'INSERT INTO community_posts (title, content, author_id, created_at) VALUES (?, ?, ?, NOW())';
    db.query(sql, [title, content, authorId], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Error creating post.');
            return res.redirect('/post');
        }
        req.flash('success', 'Post created successfully!');
        res.redirect('/dashboard');
    });
});

// View single post + comments
app.get('/post/:id', checkAuthenticated, (req, res) => {
    const postId = req.params.id;

    db.query('SELECT p.*, u.username AS author FROM community_posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?', [postId], (err, posts) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        if (posts.length === 0) return res.status(404).send('Post not found');

        const post = posts[0];

        db.query('SELECT * FROM comments WHERE post_id = ?', [postId], (err, comments) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }
            res.render('post', { user: req.session.user, post, comments });
        });
    });
});

// Add comment (auto use logged-in username)
app.post('/post/:id/comment', checkAuthenticated, (req, res) => {
    const postId = req.params.id;
    const user = req.session.user.username;
    const { text } = req.body;

    const sql = 'INSERT INTO comments (post_id, user, text, created_at) VALUES (?, ?, ?, NOW())';
    db.query(sql, [postId, user, text], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not add comment.');
            return res.redirect(`/post/${postId}`);
        }
        req.flash('success', 'Comment added!');
        res.redirect(`/post/${postId}`);
    });
});

// Leaderboard route
app.get('/leaderboard', checkAuthenticated, (req, res) => {
    const sql = `
        SELECT u.username, COUNT(p.id) AS posts_count
        FROM users u
        LEFT JOIN community_posts p ON u.id = p.author_id
        GROUP BY u.username
        ORDER BY posts_count DESC
        LIMIT 10
    `;
    db.query(sql, (err, leaderboard) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        res.render('leaderboard', { user: req.session.user, leaderboard });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
