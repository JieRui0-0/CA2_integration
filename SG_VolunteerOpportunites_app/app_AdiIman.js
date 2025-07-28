const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Republic_C207',
    database: 'sg_volunteer'

    //host:'i9joyz.h.filess.io',
    //user:'supermarketdatabase_usrocketus',
    //password:'18dae80c592bf2862d31ad0da9ecdd17c846aefa',
    //database:'supermarketdatabase_usrocketus'
});


connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/userpage');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index2', {user: req.session.user} );
});


app.get('/sg__volunteer_opportunities', (req, res) => {
    const sql = 'SELECT * FROM opportunities';
    //Fetch data from MySQL
    connection.query(sql, (error, results) => {
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
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving announcements');
        }

        res.render('sg_announcements', { announcements: results }); // Render HTML page with data
    });
});

/*app.get('/inventory_admin', checkAuthenticated, checkAdmin, (req, res) => {
    // Fetch data from MySQL
    connection.query('SELECT * FROM opportunities', (error, results) => {
        if (error) throw error;
        res.render('inventory_admin', { opportunities: results, user: req.session.user });
    });
});*/

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  const getOpportunities = new Promise((resolve, reject) => {
    connection.query('SELECT * FROM opportunities ORDER BY date DESC', (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  const getAnnouncements = new Promise((resolve, reject) => {
    connection.query('SELECT * FROM announcements ORDER BY date_posted DESC', (err, results) => {
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

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

/*app.get('/userpage', checkAuthenticated, (req, res) => {
  res.render('userpage', { user: req.session.user });
});*/

app.get('/userpage', checkAuthenticated,(req, res) => {
    // Fetch data from MySQL
    //connection.query('SELECT * FROM opportunities', (error, results) => {
       // if (error) throw error;
        //res.render('userpage', { opportunities: results, user: req.session.user });
    //});
//});

const getOpportunities = new Promise((resolve, reject) => {
    connection.query('SELECT * FROM opportunities ORDER BY date DESC', (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  const getAnnouncements = new Promise((resolve, reject) => {
    connection.query('SELECT * FROM announcements ORDER BY date_posted DESC', (err, results) => {
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

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            if (req.session.user.role == 'user')
                res.redirect('/userpage');
            else
                res.redirect('/admin');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/opportunities/:id', (req, res) => {
    // Extract the opportunities ID from the request parameters
    const opportunitiesId = req.params.id;

    // Fetch data from MySQL based on the opportunities ID
    connection.query('SELECT * FROM opportunities WHERE opportunitiesId = ?', [opportunitiesId], (error, results) => {
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

app.get('/addopportunities', checkAuthenticated, checkAdmin,(req, res) => {
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
  connection.query(sql, [image, opportunitiesName, organization, date, location, contact_email], (error, results) => {
    if (error) {
      console.error("Error adding opportunities:", error);
      res.status(500).send('Error adding opportunities');
    } else {
      res.redirect('/admin');
    }
  });
});


// Add new announcement (admin only)
app.get('/addannouncements', checkAuthenticated, checkAdmin,(req, res) => {
  res.render('addannouncements');
});

app.post('/addannouncements', (req, res) => {
  const { title, message, date_posted } = req.body;
  const sql = 'INSERT INTO announcements (title, message, date_posted) VALUES (?, ?,?)';
  connection.query(sql, [title, message, date_posted], (err) => {
    if (err) {
      console.error("Error adding announcements:", err);
      res.status(500).send('Error adding announcements');
    } else {
      res.redirect('/admin');
    }
  });
});

app.get('/updateopportunities/:id', checkAuthenticated, checkAdmin,(req, res) => {
    const opportunitiesId = req.params.id;
    const sql = 'SELECT * FROM opportunities WHERE opportunitiesId = ?';

    connection.query(sql, [opportunitiesId], (error, results) => {
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

    connection.query(sql, [opportunitiesName, organization, date, location, contact_email, image, opportunitiesId], (error, results) => {
        if (error) {
            console.error('Error updating opportunities:', error);
            return res.status(500).send('Error updating opportunities');
        }
        else {
            res.redirect('/admin');
        }
    });

});


app.get('/updateannouncements/:id' ,checkAuthenticated, checkAdmin,(req, res) => {
  const idannouncements= req.params.id;

  const sql = 'SELECT * FROM announcements WHERE idannouncements = ?';
  connection.query(sql, [idannouncements], (err, results) => {
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
  connection.query(sql, [title, message,date_posted,idannouncements], (err) => {
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

    connection.query(sql, [opportunitiesId], (error, results) => {
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

    connection.query(sql, [Idannouncements], (error, results) => {
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

  connection.query(sql, [keyword, keyword], (err, results) => {
    if (err) {
      console.error('Search error:', err);
      res.status(500).send('Error searching opportunities');
    } else {
      res.render('opportunities', { opportunities: results });
    }
  });
});

  app.post('/sg_announcements/search',  (req, res) => {
  const keyword = '%' + req.body.keyword + '%';

  const sql = `
    SELECT * FROM announcements 
    WHERE title LIKE ? OR message LIKE ?
    ORDER BY date_posted DESC
  `;

  connection.query(sql, [keyword, keyword], (err, results) => {
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

  




/*app.get('/deleteopportunities/:id', (req, res) => {
//const opportunitiesId = req.params.id;

//connection.query('DELETE FROM opportunities WHERE opportunitiesId = ?', [opportunitiesId], (error, results) => {
//if (error) {
// Handle any error that occurs during the database operation
//console.error("Error deleting opportunities:", error);
//res.status(500).send('Error deleting opportunities');
//} else {
// Send a success response
//res.redirect('/sg_volunteer_opportunities');
//}
//});
});*/


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));