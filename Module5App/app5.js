const express = require('express');
const mysql = require('mysql2');
const multer = require('multer')
//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session')
const flash = require('connect-flash');
const { render } = require('ejs');
const app = express();

// Set up multer for file uploads 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); //directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Database connection
const db = mysql.createConnection({
    //host: 'rfno8u.h.filess.io',
    //port: 3307,
    //user: 'C237CA_factrealno',
    //password: 'd93d32aa308c5ea0f28b4ce6aa9b4e2c3804cbf8',
    //database: 'C237CA_factrealno'
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'ca_testing'
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** TODO: Insert code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of activity 
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

// admin/user stuff
//******** TODO: Create a Middleware to check if user is logged in. ********//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// const checkUser = (req, res, next) => {
//     if (req.session.user && req.session.user.role === 'user') {
//         return next();
//     } else {
//         req.flash('error', 'Access denied');
//         res.redirect('/user');
//     }
// };

//******** TODO: Create a middleware function validateRegistration ********//
const validateRegistration = (req, res, next) => {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password || !role) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body); // so form can repopulate fields
        return res.redirect('/register');

    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next(); // If all validations pass, the next function is called, allowing the request to proceed to the next middleware function or route handler.
};

//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { name, username, email, password, role } = req.body;

    const sql = 'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, SHA1(?), ?)';
    db.query(sql, [name, username, email, password, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
    res.render('login_jierui', {
        messages: req.flash('success'), // Retrieve success messages from the session and pass them to the view
        errors: req.flash('error') // Retrieve error messages from the session and pass them to the view
    });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Routes
//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/register', (req, res) => {
    const errors = req.flash('error');
    const messages = req.flash('success');
    const formData = req.flash('formData')[0] || {};
    res.render('register_jierui', { errors, messages, formData });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard_jierui', { user: req.session.user });
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
// app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
//     res.render('admin', { user: req.session.user });
//});

app.get('/', checkAuthenticated, (req, res) => {
    res.render('index_jierui')
})
app.get('/rewards', checkAuthenticated, (req, res) => {
    const user = req.session.user;

    db.query('SELECT * FROM reward_badges', (err, results) => {
        if (err) throw err;
        res.render('rewards', { reward_badges: results, user: user, messages: req.flash('success') });
    });
});

app.get('/reward/:id', (req, res) => {
    
    const rewardId = req.params.id;
    const sql = 'SELECT * FROM reward_badges WHERE rewardId = ?';

    // Fetch data from MySQL based on the reward ID
    db.query(sql, [rewardId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving reward by ID');
        }

        // Check if any product with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the product data
            res.render('reward', { reward: results[0] });
        } else {
            // If no product with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('reward not found');
        }
    });
});

app.get('/editReward/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const id = req.params.id;
    const user = req.session.user;
    db.query('SELECT * FROM reward_badges WHERE rewardId = ?', [id], (err, results) => {
        if (err) throw err;
        res.render('editRewards', { reward: results[0], user: user, action: 'Update' });
    });
});

app.get('/addRewards', checkAuthenticated, checkAdmin, (req, res) => {
    const user = req.session.user;
    const sql = 'SELECT * FROM reward_badges ORDER BY rewardId DESC LIMIT 1';
    db.query(sql, (err, results) => {
        if (err) throw err;

        const reward = results.length > 0 ? results[0] : {}; 
        res.render('addRewards', { reward: reward, user: user, action: 'Add' });
    });
});

app.get('/suggestion', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    db.query('SELECT * FROM reward_suggestion', (err, results) => {
        if (err) throw err;
        res.render('rewards', { reward_badges: results, user: user, messages: req.flash('success') });
    });
    res.render('Suggestion');
});

app.post('/addRewards', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const { name, description, criteria } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    db.query(
        'INSERT INTO reward_badges (name, description, criteria, image) VALUES (?, ?, ?, ?)',
        [name, description, criteria, image],
        (err) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Insert failed.');
                return res.redirect('/rewards');
            }
            req.flash('success', 'Reward added!');
            res.redirect('/rewards');
        }
    );
});


app.post('/editReward/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const rewardId = req.params.id;
    const { name, description, criteria } = req.body;
    //Extract  data from the request body
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) {//if new image is uploaded
        image = req.file.filename; //set image to be new image filename
    }
    const sql = 'UPDATE reward_badges SET name = ? , description = ?, criteria = ?, image=?  WHERE rewardId = ?';

    db.query(sql, [name, description, criteria, image, rewardId], (error, results) => {
        if (error) {
            console.error('Error updating opportunities:', error);
            return res.status(500).send('Error updating opportunities');
        }
        else {
            res.redirect('/rewards');
        }
    });

});

app.get('/rewards/search', checkAuthenticated, (req, res) => {
    const user = req.session.user;
    const keyword = `%${req.query.q}%`;
    db.query('SELECT * FROM reward_badges WHERE name LIKE ? OR criteria LIKE ?', [keyword, keyword], (err, results) => {
        if (err) throw err;
        res.render('rewards', { reward_badges: results, user: user, messages: req.flash('success') });
    });
});

app.get('/deleteReward/:id', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('DELETE FROM reward_badges WHERE rewardId = ?', [req.params.id], (err) => {
        if (err) throw err;
        req.flash('success', 'Reward deleted!');
        res.redirect('/rewards');
    });
});

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});