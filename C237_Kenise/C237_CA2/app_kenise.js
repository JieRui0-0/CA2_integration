/* HOME PAGE */
app.get('/', (req, res) => {
    const feedbackQuery = `
        SELECT f.id, f.attendee_name, f.rating, f.comments, e.name AS event_name
        FROM feedback f
        JOIN community_events e ON f.event_id = e.id
        ORDER BY f.id DESC LIMIT 4
    `;
    db.query(feedbackQuery, (err, feedbacks) => {
        if (err) {
            console.error("MySQL error loading homepage feedback:", err);
            return res.render('index', { feedbacks: [] });
        }
        res.render('index', { feedbacks });
    });
});

/* LOGIN */
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) throw err;
        if (results.length === 0 || results[0].password !== password) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }
        req.session.user = results[0];
        res.redirect('/dashboard');
    });
});

/* REGISTER */
app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/register', (req, res) => {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password || !role) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/register');
    }

    db.query(
        'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, username, email, password, role],
        (err) => {
            if (err) {
                req.flash('error', 'Registration failed: ' + err.message);
                return res.redirect('/register');
            }
            req.flash('success', 'Registration successful, please login');
            res.redirect('/login');
        }
    );
});

/* DASHBOARD */
app.get('/dashboard', checkAuthenticated, (req, res) => {
    const eventsQuery = 'SELECT * FROM community_events ORDER BY date DESC';
    const feedbackQuery = `
        SELECT f.id, f.attendee_name, f.rating, f.comments, e.name AS event_name
        FROM feedback f
        JOIN community_events e ON f.event_id = e.id
        ORDER BY f.id DESC
    `;

    db.query(eventsQuery, (err, events) => {
        if (err) {
            console.error("MySQL error loading dashboard events:", err);
            req.flash('error', 'Failed to load events');
            return res.redirect('/');
        }
        db.query(feedbackQuery, (err, feedbacks) => {
            if (err) {
                console.error("MySQL error loading feedbacks:", err);
                req.flash('error', 'Failed to load feedbacks');
                return res.redirect('/');
            }
            res.render('dashboard', {
                user: req.session.user,
                events,
                feedbacks,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    });
});

/* EVENTS ROUTES */
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
        return res.redirect('/events/add');
    }

    db.query(
        'INSERT INTO community_events (name, date, location, description) VALUES (?, ?, ?, ?)',
        [name, date, location, description],
        (err) => {
            if (err) {
                console.error("MySQL Error on add event:", err);
                req.flash('error', 'Failed to add event');
                return res.redirect('/events/add');
            }
            req.flash('success', 'Event added successfully');
            res.redirect('/dashboard');
        }
    );
});

app.get('/events/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const eventId = req.params.id;
    db.query('SELECT * FROM community_events WHERE id = ?', [eventId], (err, result) => {
        if (err || result.length === 0) {
            req.flash('error', 'Event not found');
            return res.redirect('/dashboard');
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
            res.redirect('/dashboard');
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
        res.redirect('/dashboard');
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
            return res.redirect('/dashboard');
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

/* LOGOUT */
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

/* START SERVER */
app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
