const express = require('express');
const mysql = require('mysql2');
const multer = require('multer')
//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session')
const flash = require('connect-flash');
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
    host: 'c237-all.mysql.database.azure.com',
    port: 3306,
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_jierui'
    // host: 'localhost',
    // user: 'root',
    // password: 'RP738964$',
    // databse: 'ca_testing'
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
        res.redirect('/dashboard_jierui');
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

// //******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
     res.render('login', {
        messages: req.flash('success'), // Retrieve success messages from the session and pass them to the view
        errors: req.flash('error') // Retrieve error messages from the session and pass them to the view
    });
});

//******** TODO: Insert code for logout route ********//
// app.get('/logout', (req, res) => {
//     req.session.destroy();
//     res.redirect('/');
// });

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
            res.redirect('/dashboard_jierui');
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
    res.render('register', { errors, messages, formData });
});

app.get('/dashboard_jierui', checkAuthenticated, (req, res) => {
    res.render('dashboard_jierui', { user: req.session.user });
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
// app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
//     res.render('admin', { user: req.session.user });
//});

// app.get('/', checkAuthenticated, (req, res) => {
//     res.render('index')
// })
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
    db.query(
      'SELECT * FROM reward_suggestion WHERE username = ? ORDER BY create_at DESC',
      [user.username],
      (err, results) => {
          if (err) {
              console.error('SQL Select Error:', err);
              return res.render('Suggestion', { reward_suggestion: [], user, messages: ['Error loading suggestions.'] });
          }
          res.render('Suggestion', { 
              reward_suggestion: results, 
              user, 
              messages: req.flash('success') 
          });
      }
    );
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
    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
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

// Submit a suggestion
app.post('/suggestion', checkAuthenticated, upload.single('image'), (req, res) => {
    const { reward_name, description, criteria } = req.body;
    const username = req.session.user.username; 
    const create_at = new Date().toISOString().slice(0, 19).replace('T', ' '); // MySQL datetime format
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    db.query(
        'INSERT INTO reward_suggestion (username, reward_name, description, criteria, image, create_at) VALUES (?, ?, ?, ?, ?, ?)',
        [username, reward_name, description, criteria, image, create_at],
        (err) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Failed to submit suggestion.');
                return res.redirect('/rewards');
            }
            req.flash('success', 'Your suggestion was submitted!');
            res.redirect('/suggestion'); // show suggestion box
        }
    );
});

app.get('/deleteSuggestion/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const suggestionId = req.params.id;
    db.query('DELETE FROM reward_suggestion WHERE suggestionId = ?', [suggestionId], (err, results) => {
        if (err) {
            console.error('Error deleting suggestion:', err);
            req.flash('error', 'Failed to delete suggestion.');
            return res.redirect('/suggestion');
        }
        req.flash('success', 'Suggestion deleted successfully.');
        res.redirect('/suggestion');
    });
});
// app.post('/deleteSuggestion/:id', checkAuthenticated, checkAdmin, (req, res) => {
//     const suggestionId = req.params.id;
//     db.query('DELETE FROM reward_suggestion WHERE suggestionId = ?', [suggestionId], (err) => {
//         if (err) {
//             console.error(err);
//             req.flash('error', 'Failed to delete suggestion.');
//         } else {
//             req.flash('success', 'Suggestion deleted successfully.');
//         }
//         res.redirect('/suggestion');
//     });
// });


// Adi section //


app.get('/sg__volunteer_opportunities', (req, res) => {
    const sql = 'SELECT * FROM opportunities';
    //Fetch data from MySQL
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving opportunities');
        }

        res.render('sg_volunteer_opportunities', { opportunities: results }); // Render HTML page with data
    });
});

app.get('/sg_announcements', (req, res) => {
    const sql = 'SELECT * FROM announcements';
    //Fetch data from MySQL
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving announcements');
        }

        res.render('sg_announcements', { announcements: results }); // Render HTML page with data
    });
});


app.get('/admin', checkAuthenticated, (req, res) => {
    const getOpportunities = new Promise((resolve, reject) => {
        db.query('SELECT * FROM opportunities ORDER BY date DESC', (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });

    const getAnnouncements = new Promise((resolve, reject) => {
        db.query('SELECT * FROM announcements ORDER BY date_posted DESC', (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });

    Promise.all([getOpportunities, getAnnouncements])
        .then(([opportunities, announcements]) => {
            res.render('admin', {
                opportunities: opportunities,
                announcements: announcements,
                user: req.session.user
            });
        })
        .catch((err) => {
            console.error('Error loading admin page:', err);
            res.status(500).send('Error loading page');
        });
});

app.get('/userpage', checkAuthenticated, (req, res) => {
    // Fetch data from MySQL
    //connection.query('SELECT * FROM opportunities', (error, results) => {
    // if (error) throw error;
    //res.render('userpage', { opportunities: results, user: req.session.user });
    //});
    //});

    const getOpportunities = new Promise((resolve, reject) => {
        db.query('SELECT * FROM opportunities ORDER BY date DESC', (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });

    const getAnnouncements = new Promise((resolve, reject) => {
        db.query('SELECT * FROM announcements ORDER BY date_posted DESC', (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });


    Promise.all([getOpportunities, getAnnouncements])
        .then(([opportunities, announcements]) => {
            res.render('admin', {
                opportunities: opportunities,
                announcements: announcements,
                user: req.session.user
            });
        })
        .catch((err) => {
            console.error('Error loading user page:', err);
            res.status(500).send('Error loading page');
        });
});


app.get('/opportunities/:id', (req, res) => {
    // Extract the opportunities ID from the request parameters
    const opportunitiesId = req.params.id;

    // Fetch data from MySQL based on the opportunities ID
    db.query('SELECT * FROM opportunities WHERE opportunitiesId = ?', [opportunitiesId], (error, results) => {
        if (error) throw error;

        // Check if any opportunities with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the opportunities data
            res.render('opportunities', { opportunities: results[0], user: req.session.user });
        } else {
            // If no opportunities with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('opportunities not found');
        }
    });
});

app.get('/addopportunities', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addopportunities');
});

app.post('/addopportunities', upload.single('image'), (req, res) => {
    const { opportunitiesName, organization, date, location, contact_email } = req.body;

    let image;
    if (req.file) {
        image = req.file.filename; // Save the uploaded image filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO opportunities (image, opportunitiesName, organization, date, location, contact_email) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [image, opportunitiesName, organization, date, location, contact_email], (error, results) => {
        if (error) {
            console.error("Error adding opportunities:", error);
            res.status(500).send('Error adding opportunities');
        } else {
            res.redirect('/admin');
        }
    });
});


// Add new announcement (admin only)
app.get('/addannouncements', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addannouncements');
});

app.post('/addannouncements', checkAuthenticated, checkAdmin, (req, res) => {
    const { title, message, date_posted } = req.body;
    const sql = 'INSERT INTO announcements (title, message, date_posted) VALUES (?, ?, ?)';
    db.query(sql, [title, message, date_posted], (err) => {
        if (err) {
            console.error("Error adding announcements:", err);
            res.status(500).send('Error adding announcements');
        } else {
            res.redirect('/admin');
        }
    });
});

app.get('/updateopportunities/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const opportunitiesId = req.params.id;
    const sql = 'SELECT * FROM opportunities WHERE opportunitiesId = ?';

    db.query(sql, [opportunitiesId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving opportunities by ID');
        }
        if (results.length > 0) {
            res.render('updateopportunities', { opportunities: results[0] });
        } else {
            res.status(404).send('opportunities not found');
        }
    });

});

app.post('/updateopportunities/:id', upload.single('image'), (req, res) => {
    const opportunitiesId = req.params.id;
    const { opportunitiesName, organization, date, location, contact_email } = req.body;
    //Extract  data from the request body
    let image = req.body.currentImage; // retrieve current image filename
    if (req.file) {//if new image is uploaded
        image = req.file.filename; //set image to be new image filename
    }
    const sql = 'UPDATE opportunities SET opportunitiesName = ? , organization = ?, date = ?, location = ?, contact_email = ?, image=?  WHERE opportunitiesId = ?';

    db.query(sql, [opportunitiesName, organization, date, location, contact_email, image, opportunitiesId], (error, results) => {
        if (error) {
            console.error('Error updating opportunities:', error);
            return res.status(500).send('Error updating opportunities');
        }
        else {
            res.redirect('/admin');
        }
    });

});


app.get('/updateannouncements/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const idannouncements = req.params.id;

    const sql = 'SELECT * FROM announcements WHERE idannouncements = ?';
    db.query(sql, [idannouncements], (err, results) => {
        if (err) {
            console.error("Error fetching announcements:", err);
            return res.status(500).send('Error loading announcements.');
        }

        if (results.length > 0) {
            res.render('updateannouncements', { announcements: results[0] });
        } else {
            res.status(404).send('Announcements not found');
        }
    });
});

app.post('/updateannouncements/:id', (req, res) => {
    const idannouncements = req.params.id;
    const { title, message, date_posted } = req.body;

    const sql = 'UPDATE announcements SET title = ?, message = ? , date_posted = ? WHERE idannouncements = ?';
    db.query(sql, [title, message, date_posted, idannouncements], (err) => {
        if (err) {
            console.error("Error updating announcements:", err);
            return res.status(500).send('Error updating announcements.');
        }

        res.redirect('/admin');
    });
});


app.get('/deleteopportunities/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const opportunitiesId = req.params.id;

    const sql = 'DELETE FROM opportunities WHERE opportunitiesId = ?';

    db.query(sql, [opportunitiesId], (error, results) => {
        if (error) {
            console.error("Error deleting opportunities:", error);
            return res.status(500).send('Error deleting opportunity');
        }

        // Redirect user back to the list page after successful deletion
        res.redirect('/admin');
    });
});


app.get('/deleteannouncements/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const Idannouncements = req.params.id;

    const sql = 'DELETE FROM announcements WHERE Idannouncements = ?';

    db.query(sql, [Idannouncements], (error, results) => {
        if (error) {
            console.error("Error deleting announcements:", error);
            return res.status(500).send('Error deleting announcements');
        }

        // Redirect user back to the list page after successful deletion
        res.redirect('/admin');
    });
});


app.post('/sg__volunteer_opportunities/search', (req, res) => {
    const keyword = '%' + req.body.keyword + '%';

    const sql = `
    SELECT * FROM opportunities 
    WHERE opportunitiesName LIKE ? OR organization LIKE ?
  `;

    db.query(sql, [keyword, keyword], (err, results) => {
        if (err) {
            console.error('Search error:', err);
            res.status(500).send('Error searching opportunities');
        } else {
            res.render('opportunities', { opportunities: results });
        }
    });
});

app.post('/sg_announcements/search', (req, res) => {
    const keyword = '%' + req.body.keyword + '%';

    const sql = `
    SELECT * FROM announcements 
    WHERE title LIKE ? OR message LIKE ?
    ORDER BY date_posted DESC
  `;

    db.query(sql, [keyword, keyword], (err, results) => {
        if (err) {
            console.error('Search error:', err);
            res.status(500).send('Error searching announcements');
        } else {
            res.render('announcements', {
                announcements: results,
                user: req.session.user // make sure to pass this if EJS uses `user`
            });
        }
    });
});


// Balerie Section //

// Home
app.get('/', (req, res) => {
    res.render('index', {
        users: req.session.user,
        messages: req.flash('success')
    });
});

// app.post('/login', (req, res) => {
//     const { email, password } = req.body;

//     if (!email || !password) {
//         req.flash('error', 'All fields are required.');
//         return res.redirect('/login');
//     }

//     const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
//     db.query(sql, [email, password], (err, results) => {
//         if (err) {
//             console.error('Database error:', err);
//             req.flash('error', 'Database error, please try again.');
//             return res.redirect('/login');
//         }

//         if (results.length === 0) {
//             req.flash('error', 'Invalid email or password.');
//             return res.redirect('/login');
//         }

//         req.session.user = results[0];
//         req.flash('success', 'Logged in successfully!');
//         return res.redirect(results[0].role === 'admin' ? '/admin' : '/dashboard');
//     });
// });

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Dashboards
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard_bal', {
        users: req.session.user,
        messages: req.flash('success')
    });
});

app.get('/admin_bal', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin_bal', {
        users: req.session.user,
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
            return res.redirect('/admin_bal');
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


// Hellspawn section

// app.get('/dashboard', checkAuthenticated, (req, res) => {
//     const eventsQuery = 'SELECT * FROM community_events ORDER BY date DESC';
//     const feedbackQuery = `
//         SELECT f.id, f.attendee_name, f.rating, f.comments, e.name AS event_name
//         FROM feedback f
//         JOIN community_events e ON f.event_id = e.id
//         ORDER BY f.id DESC
//     `;

//     db.query(eventsQuery, (err, events) => {
//         if (err) {
//             console.error("MySQL error loading dashboard events:", err);
//             req.flash('error', 'Failed to load events');
//             return res.redirect('/');
//         }
//         db.query(feedbackQuery, (err, feedbacks) => {
//             if (err) {
//                 console.error("MySQL error loading feedbacks:", err);
//                 req.flash('error', 'Failed to load feedbacks');
//                 return res.redirect('/');
//             }
//             res.render('dashboard', {
//                 user: req.session.user,
//                 events,
//                 feedbacks,
//                 messages: req.flash('success'),
//                 errors: req.flash('error')
//             });
//         });
//     });
// });

app.get('/events', (req, res) => {
    const searchTerm = req.query.search;
    let sql = 'SELECT * FROM community_events';
    let params = [];

    if (searchTerm && searchTerm.trim() !== '') {
        sql += ' WHERE name LIKE ? OR location LIKE ? OR description LIKE ?';
        const wildcard = `%${searchTerm}%`;
        params = [wildcard, wildcard, wildcard];
    }

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("MySQL Error on events list:", err);
            return res.send("Error loading events: " + err.message);
        }
        res.render('events', {
            user: req.session.user || null,
            events: results,
            messages: req.flash('success'),
            search: searchTerm || ''
        });
    });
});

app.get('/events/add', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addEvent', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/events/add', checkAuthenticated, checkAdmin, (req, res) => {
    const { name, date, location, description } = req.body;

    if (!name || !date || !location || !description) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/events');
    }

    db.query(
        'INSERT INTO community_events (name, date, location, description) VALUES (?, ?, ?, ?)',
        [name, date, location, description],
        (err) => {
            if (err) {
                console.error("MySQL Error on add event:", err);
                req.flash('error', 'Failed to add event');
                return res.redirect('/events');
            }
            req.flash('success', 'Event added successfully');
            res.redirect('/events');
        }
    );
});

app.get('/events/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const eventId = req.params.id;
    db.query('SELECT * FROM community_events WHERE id = ?', [eventId], (err, result) => {
        if (err || result.length === 0) {
            req.flash('error', 'Event not found');
            return res.redirect('/events');
        }
        res.render('editEvents', {
            user: req.session.user,
            event: result[0],
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.post('/events/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const eventId = req.params.id;
    const { name, date, location, description } = req.body;

    db.query(
        'UPDATE community_events SET name=?, date=?, location=?, description=? WHERE id=?',
        [name, date, location, description, eventId],
        (err) => {
            if (err) {
                req.flash('error', 'Failed to update event');
                return res.redirect(`/events/edit/${eventId}`);
            }
            req.flash('success', 'Event updated successfully');
            res.redirect('/events');
        }
    );
});

app.get('/events/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const eventId = req.params.id;
    db.query('DELETE FROM community_events WHERE id=?', [eventId], (err) => {
        if (err) {
            req.flash('error', 'Failed to delete event');
            return res.redirect('/dashboard');
        }
        req.flash('success', 'Event deleted successfully');
        res.redirect('/events');
    });
});

/* FEEDBACK ROUTES */
app.get('/feedback', checkAuthenticated, checkAdmin, (req, res) => {
    const search = req.query.search;
    let sql = `
        SELECT f.id, f.attendee_name, f.rating, f.comments, e.name AS event_name
        FROM feedback f
        JOIN community_events e ON f.event_id = e.id
    `;
    let params = [];

    if (search && search.trim() !== '') {
        sql += ' WHERE e.name LIKE ? OR f.attendee_name LIKE ?';
        const wildcard = `%${search}%`;
        params = [wildcard, wildcard];
    }

    db.query(sql, params, (err, feedbacks) => {
        if (err) {
            console.error("MySQL error on feedback list:", err);
            req.flash('error', 'Failed to load feedback list');
            return res.redirect('/admin_bal');
        }
        res.render('feedback', {
            user: req.session.user,
            feedbacks,
            messages: req.flash('success'),
            errors: req.flash('error'),
            search: search || ''
        });
    });
});

app.get('/feedback/add', checkAuthenticated, (req, res) => {
    db.query('SELECT id, name FROM community_events', (err, events) => {
        if (err) {
            req.flash('error', 'Failed to load events for feedback');
            return res.redirect('/dashboard');
        }
        res.render('addFeedback', {
            events,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.post('/feedback/add', checkAuthenticated, (req, res) => {
    const { event_id, attendee_name, rating, comments } = req.body;

    if (!event_id || !attendee_name || !rating || !comments) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/feedback/add');
    }

    db.query(
        'INSERT INTO feedback (event_id, attendee_name, rating, comments) VALUES (?, ?, ?, ?)',
        [event_id, attendee_name, rating, comments],
        (err) => {
            if (err) {
                console.error("MySQL error adding feedback:", err);
                req.flash('error', 'Failed to submit feedback');
                return res.redirect('/feedback/add');
            }
            req.flash('success', 'Feedback submitted successfully');
            res.redirect('/dashboard');
        }
    );
});

app.get('/feedback/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const feedbackId = req.params.id;

    db.query('SELECT * FROM feedback WHERE id=?', [feedbackId], (err, result) => {
        if (err || result.length === 0) {
            req.flash('error', 'Feedback not found');
            return res.redirect('/feedback');
        }

        res.render('editFeedback', {
            feedback: result[0],
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.post('/feedback/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const feedbackId = req.params.id;
    const { event_id, attendee_name, rating, comments } = req.body;

    db.query(
        'UPDATE feedback SET event_id=?, attendee_name=?, rating=?, comments=? WHERE id=?',
        [event_id, attendee_name, rating, comments, feedbackId],
        (err) => {
            if (err) {
                req.flash('error', 'Failed to update feedback');
                return res.redirect(`/feedback/edit/${feedbackId}`);
            }
            req.flash('success', 'Feedback updated successfully');
            res.redirect('/feedback');
        }
    );
});

app.get('/feedback/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const feedbackId = req.params.id;

    db.query('DELETE FROM feedback WHERE id=?', [feedbackId], (err) => {
        if (err) {
            req.flash('error', 'Failed to delete feedback');
            return res.redirect('/feedback');
        }
        req.flash('success', 'Feedback deleted successfully');
        res.redirect('/feedback');
    });
});

// Amelia route //
// ?? she doesnt have anything


// davian route
app.get('/dashboard_dav', checkAuthenticated, (req, res) => {
    const sql = `
        SELECT p.id, p.title, p.content, u.username AS author, p.create_at
        FROM community_posts p
        JOIN users u ON p.author_id = u.id
        ORDER BY p.create_at DESC
    `;

    db.query(sql, (err, posts) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Database error: ' + err.message);
            return res.redirect('/');
        }
        res.render('dashboard_davian', { user: req.session.user, posts });
    });
});

// Create new post
app.get('/post', checkAuthenticated, (req, res) => {
    res.render('create_post', { user: req.session.user });
});

app.post('/post', checkAuthenticated, (req, res) => {
    const { title, content } = req.body;
    const authorId = req.session.user.id;

    const sql = 'INSERT INTO community_posts (title, content, author_id, create_at) VALUES (?, ?, ?, NOW())';
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

    const sql = 'INSERT INTO comments (post_id, user, text, create_at) VALUES (?, ?, ?, NOW())';
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


// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});