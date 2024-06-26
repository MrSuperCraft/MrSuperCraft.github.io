const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(express.static('resources'));
app.use(express.static('presets'));
app.use('/scripts', express.static('scripts'));


app.use(express.json());


// SQLite database connection
const db = new sqlite3.Database('mydb.db');

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(session({
    secret: 'DQUTl2U6CMafs9CZgDB22XHTpObhYgLXk7AcwvQlV6yjd5DHZB7Izz93R4r9uRvIU1roVAOWicOw7Xslrk0fh6vKBiP9icLO40HR6W9QSWkGAmPOqMzq4Yj84eIpd40R7V', // Change this to a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: {
        path: '/',
        secure: false, // Change to false if not using HTTPS
        httpOnly: true,
    }
}));



// Static routes

app.get('/', (req, res) => {
    // Pass the req object as a local variable
    res.render('index', { req });
});

app.get('/login', (req, res) => {
    // Check if the user is already authenticated
    if (req.session.username) {
        // If authenticated, redirect to the design page
        res.redirect(`/design/${encodeURIComponent(req.session.username)}`);
    } else {
        // If not authenticated, render the login page
        res.render("login");
    }
});


app.get('/logout', (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Redirect the user to the home page or any desired page after logout
        res.redirect('/');
    });
});

app.get('/pages', (req, res) => {
    res.render("page-list");
})

app.get('/signup', (req, res) => {
    res.render("signup");
});

app.get('/credits', (req, res) => {
    res.render("credits");
});

app.get('/design', isAuthenticated, (req, res) => {
    const username = req.session.username;
    const userId = req.session.userId;


    // Render the page with the retrieved username
    res.render('dropup', { username, userId });
});

app.get('/design/:identifier', async (req, res) => {
    try {
        // Properly decode the identifier
        const decodedIdentifier = decodeURIComponent(req.params.identifier);
        console.log('Decoded Identifier:', decodedIdentifier);

        // Check if the authenticated user's username matches the requested username
        if (req.session.username !== decodedIdentifier) {
            // Redirect to the authenticated user's own page or a login page if not authenticated
            return res.redirect(req.session.username ? `/design/${encodeURIComponent(req.session.username)}` : '/login');
        }

        // Query the database to get the user based on the decoded identifier
        const user = await getUserByUsername(decodedIdentifier);
        if (user) {
            // Retrieve social media buttons for the user
            const query = 'SELECT * FROM social_media_buttons WHERE user_id = ?';
            db.all(query, [user.id], (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Use the retrieved username  for rendering the page
                res.render('dropup', { username: user.username, userId: user.id });
            });
        } else {
            // Handle the case when the user is not found
            console.log('User not found for identifier:', decodedIdentifier);
            res.render('dropup', { username: 'Guest' }); // You can set a default or handle it as needed
        }
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).render('500'); // Render an error page for server errors
    }
});



function isAuthenticated(req, res, next) {
    console.log('Session in isAuthenticated middleware:', req.session);

    // Check if the username is present in the session
    if (req.session.username) {
        console.log('User is authenticated:', req.session.username);
        return next(); // Proceed to the next middleware/route handler
    } else {
        // User is not authenticated, redirect to the 404 page
        console.log('User not authenticated. Redirecting to 404 page.');
        res.status(404).render('404'); // Assuming '404' is the name of your 404 page
    }
}

// Admin authentication middleware
function isAdminAuthenticated(req, res, next) {
    if (req.session.isAdmin) {
        // Admin is authenticated, proceed to the next middleware/route handler
        return next();
    } else {
        // Admin is not authenticated, log and redirect to the admin login page
        console.log('Admin not authenticated. Redirecting to admin login page after a delay.');
        setTimeout(() => {
            req.session.save(err => {
                if (err) {
                    console.error('Error saving session:', err);
                }
                res.redirect('/admin-login');
            });
        }, 1000); // 1 second delay
    }
}


app.post('/authenticate', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        console.log('Attempting to authenticate user:', identifier);

        // Check if the user exists in the database
        const user = await getUserByEmailOrUsername(identifier);

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        // Ensure the user object has a 'password' property
        if (!user.password) {
            console.log('User password not found');
            return res.status(500).json({ message: 'User password not found' });
        }

        // Compare the hashed password with the provided password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            console.log('Login successful');

            // Save user information in the session
            req.session.username = user.username;

            // Fetch the user's ID from the database
            const userIdQuery = 'SELECT ID FROM Users WHERE Username = ?';
            db.get(userIdQuery, [user.username], (err, row) => {
                if (err) {
                    console.error('Error fetching user ID:', err);
                    return res.status(500).json({ success: false, message: 'Internal Server Error' });
                }

                // Check if the user has an ID
                if (row && row.ID) {
                    req.session.userId = row.ID;

                    req.session.save(err => {
                        if (err) {
                            console.error('Error saving session:', err);
                            return res.status(500).json({ success: false, message: 'Internal Server Error' });
                        }

                        console.log('Session saved successfully.');

                        // Redirect after the session is saved
                        const redirectRoute = user.isAdmin ? '/admin-panel' : `/design/${encodeURIComponent(user.username)}`;
                        return res.status(200).json({ success: true, message: 'Login successful', redirect: redirectRoute });
                    });
                } else {
                    console.error('User ID not found in the database.');
                    return res.status(500).json({ success: false, message: 'Internal Server Error' });
                }
            });
        } else {
            console.log('Invalid credentials');
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Error during authentication:', err.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Handle user signup form submission
app.post('/signup', async (req, res) => {
    const { email, username, password } = req.body;

    try {
        // Check if the email or username is already in use for regular users
        const existingUser = await getUserByEmailOrUsername(email, username);

        if (existingUser.email !== null || existingUser.username !== null) {
            console.log('Email or username is already in use.');
            // Send a JSON response with an error message
            return res.status(400).json({ success: false, message: 'Email or username is already in use.' });
        } else {
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Get the current date in mm/dd/yyyy format
            const membershipDate = new Date().toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
            });

            // Insert data into the 'Users' table for a regular user with Membership date
            db.run('INSERT INTO Users (Email, Username, Password, Membership) VALUES (?, ?, ?, ?)', [
                email,
                username,
                hashedPassword,
                membershipDate,
            ]);

            console.log('User registered successfully');

            // Save user information in the session
            req.session.username = username;
            req.session.userId = this.lastID;

            // Send a JSON response indicating successful signup
            return res.status(200).json({ success: true, redirect: `/design/${encodeURIComponent(username)}` });
        }
    } catch (err) {
        console.error(err.message);
        // Send a JSON response with an error message
        res.status(500).json({ success: false, message: 'Internal Server Error. Please try again later.' });
    }
});



// Add this route to handle fetching the user ID
app.get('/get-user-id', isAuthenticated, (req, res) => {
    const userId = req.session.userId; // Assuming user ID is stored in the session
    res.json({ userId });
});

// Add this route to handle fetching the username
app.post('/get-username', async (req, res) => {
    const { identifier } = req.body;

    try {
        // Query the database to get the username based on the email or username
        const user = await getUserByEmailOrUsername(identifier);

        if (user) {
            res.status(200).json({ username: user.username, userId: user.id });
        } else {
            // If user not found, you can set a default or handle it as needed
            res.status(404).json({ username: 'Guest', userId: null });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Middleware to authenticate the user and set user information in the session
app.use(async (req, res, next) => {
    // Check if the username is present in the session
    if (req.session.username) {
        try {
            // Query the database to get the user ID based on the username
            const user = await getUserByUsername(req.session.username);

            // Check if the user is found and has an ID
            if (user && user.id) {
                // Set the user ID in the session
                req.session.userId = user.id;
            }
        } catch (err) {
            console.error('Error fetching user ID:', err);
        }
    }

    // Continue to the next middleware/route handler
    next();
});



// Middleware to check if the username exists in the database
app.use('/design', isAuthenticated);

// Your existing route handling for /design
app.get('/design', (req, res) => {
    res.render('dropup');
});


// Logout route
app.get('/logout', (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy();
    res.redirect('/');
});

// Function to get user by email or username
async function getUserByEmailOrUsername(identifier) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT Email, Username, Password FROM Users WHERE Email = ? OR Username = ?';
        db.get(query, [identifier, identifier], (err, row) => {
            if (err) {
                reject(err);
            } else {

                // Ensure the user object has 'email', 'username', and 'password' properties
                const user = {
                    email: row ? row.Email : null,
                    username: row ? row.Username : null,
                    password: row ? row.Password : null,
                };

                resolve(user);
            }
        });
    });
}

// Admin login page
app.post('/admin-authenticate', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if the user exists in the database
        const user = await getUserByUsername(username);

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user is an admin
        if (user.isAdmin && user.isAdmin === 1) {
            // Ensure the user object has a 'password' property
            if (!user.password) {
                console.log('User password not found');
                return res.status(500).json({ message: 'User password not found' });
            }

            // Compare the hashed password with the provided password
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                console.log('Admin login successful');

                // Save admin information in the session
                req.session.isAdmin = true;
                req.session.username = user.username;

                // Redirect the admin to the admin panel
                res.redirect('/admin-panel');
                return;
            } else {
                console.log('Invalid credentials');

                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            console.log('Not an admin');
            return res.status(403).json({ message: 'Not an admin' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


// Function to get user by username
async function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT Email, Username, Password, isAdmin FROM Users WHERE Username = ?';


        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {

                // Ensure the user object has 'email', 'username', 'password', and 'isAdmin' properties
                const user = {
                    email: row ? row.Email : null,
                    username: row ? row.Username : null,
                    password: row ? row.Password : null,
                    isAdmin: row ? row.isAdmin : null,
                };

                resolve(user);
            }
        });
    });
}


app.get('/admin-login', (req, res) => {
    res.render('admin-login');
});

app.get('/admin-panel', isAdminAuthenticated, (req, res) => {
    res.render('admin-panel');
});

// Assuming you have a route for the users section
app.get('/admin-panel/users', isAdminAuthenticated, async (req, res) => {
    try {
        // Fetch users data from the database
        const users = await getAllUsers();

        // Render the admin-panel template with the users data
        res.render('admin-panel', { users: users }); // Pass the "users" variable here
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/getUserData', isAdminAuthenticated, async (req, res) => {
    try {
        const username = req.session.username;
        // Fetch user data based on the username
        const userData = await getUserData(username);

        res.json(userData);
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to get user data from the database
async function getUserData(username) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM Users WHERE Username = ?';

        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

app.get('/api/users', async (req, res) => {
    try {
        const usersPerPage = req.query.count || 6; // Default number of users per page
        const page = req.query.page || 1; // Default page number is 1

        const offset = (page - 1) * usersPerPage;

        const users = await getUsersLimited(usersPerPage, offset);
        const totalCount = await getTotalUserCount(); // Implement this function to get the total number of users

        res.status(200).json({ users, totalCount });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/api/table/users', async (req, res) => {
    try {
        const usersCount = req.query.count || 10; // Default number of users to fetch
        const users = await getUsersLimited(usersCount);
        res.status(200).json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Function to get limited users from the database with admin priority
async function getUsersLimited(usersPerPage, offset) {
    return new Promise((resolve, reject) => {
        const count = parseInt(usersPerPage, 10); // Ensure usersPerPage is a valid number
        if (isNaN(count) || count <= 0) {
            reject(new Error('Invalid usersPerPage value'));
            return;
        }

        const start = parseInt(offset, 10) || 0; // Default offset to 0 if not provided
        if (isNaN(start) || start < 0) {
            reject(new Error('Invalid offset value'));
            return;
        }

        // Modify the SQL query to exclude admin users
        db.all(`SELECT ID, Email, Username, isAdmin FROM Users WHERE isAdmin = 0 ORDER BY ID LIMIT ?, ?`, [start, count], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const users = rows.map(row => ({
                    id: row.ID,
                    email: row.Email,
                    username: row.Username,
                    isAdmin: row.isAdmin,
                }));

                resolve(users);
            }
        });
    });
}


async function getTotalUserCount() {
    return new Promise((resolve, reject) => {
        // Execute a query to count the total number of users
        db.get('SELECT COUNT(*) AS total FROM Users', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.total);
            }
        });
    });
}

// Assuming you have a route for the contact submissions section
app.get('/api/contact-submissions', isAdminAuthenticated, async (req, res) => {
    try {
        // Fetch contact submissions data from the database
        const contactSubmissions = await getAllContactSubmissions();

        // Return a JSON response
        res.json(contactSubmissions);
    } catch (error) {
        console.error('Error fetching contact submissions:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to get all contact submissions from the database
async function getAllContactSubmissions() {
    return new Promise((resolve, reject) => {
        // Replace this query with your actual query to get contact submissions from the database
        db.all('SELECT * FROM contact_submissions', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Function to get settings from the database
function getSettings() {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM settings LIMIT 1', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Function to save a single setting
function saveSetting({ setting_name, setting_value }) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO settings (setting_name, setting_value) VALUES (?, ?)', [setting_name, setting_value], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Function to update a single setting
function updateSetting({ setting_name, setting_value }) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE settings SET setting_value = ? WHERE setting_name = ?', [setting_value, setting_name], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Route to save settings
app.post('/api/save-settings', async (req, res) => {
    // Extract settings from the request body
    const settings = req.body;

    try {
        // Ensure settings is an array
        if (!Array.isArray(settings)) {
            return res.status(400).json({ message: 'Invalid settings format' });
        }

        // Iterate through settings and save or update each one
        for (const setting of settings) {
            const existingSetting = await getSettings();

            if (existingSetting) {
                await updateSetting(setting);
            } else {
                await saveSetting(setting);
            }
        }

        // Respond with a success message
        res.status(200).json({ message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Define your SQL table schema for contact submissions
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL
  )
`;

db.run(createTableQuery, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    }
});


app.use(express.json());

app.post('/api/submit-contact', (req, res) => {
    const { name, email, topic, message } = req.body;

    const insertQuery = `
    INSERT INTO contact_submissions (name, email, topic, message)
    VALUES (?, ?, ?, ?)
  `;

    db.run(insertQuery, [name, email, topic, message], function (err) {
        if (err) {
            console.error('Error inserting contact submission:', err);
            res.status(500).send('Error submitting contact form');
        } else {
            console.log('Contact submission successful');
            res.status(200).send('Contact form submitted successfully');
        }
    });
});


app.get('/api/completed-tasks', async (req, res) => {
    try {
        // Assuming you have a 'status' column in your 'contact_submissions' table
        const completedTasks = await getTasksByStatus('Completed');
        res.json(completedTasks);
    } catch (error) {
        console.error('Error fetching completed tasks:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to get tasks by status from the database
async function getTasksByStatus(status) {
    return new Promise((resolve, reject) => {
        // Replace this query with your actual query to get tasks by status from the database
        db.all('SELECT * FROM contact_submissions WHERE status = ?', [status], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

app.get('/api/in-progress-tasks', async (req, res) => {
    try {
        // Fetch in-progress tasks from the database based on status
        const inProgressTasks = await getTasksByStatus('Pending');
        res.json(inProgressTasks);
    } catch (error) {
        console.error('Error fetching in-progress tasks:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to get tasks by status from the database
async function getTasksByStatus(status) {
    return new Promise((resolve, reject) => {
        // Replace this query with your actual query to get tasks by status from the database
        db.all('SELECT * FROM contact_submissions WHERE status = ?', [status], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Update the status of a submission
app.post('/api/update-task-status', async (req, res) => {
    const { taskId, newStatus } = req.body;

    try {
        // Replace this query with your actual query to update the status in the database
        await updateTaskStatus(taskId, newStatus);

        res.status(200).json({ message: 'Task status updated successfully' });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to update the status of a task in the database
async function updateTaskStatus(taskId, newStatus) {
    return new Promise((resolve, reject) => {
        // Replace this query with your actual query to update the status in the database
        db.run('UPDATE contact_submissions SET status = ? WHERE id = ?', [newStatus, taskId], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Route for deleting a task then refreshing the view of the tasks
app.delete('/api/delete-task/:taskId', async (req, res) => {
    const taskId = req.params.taskId;

    try {
        // Assuming you have a table named 'contact_submissions' with an 'id' column as the primary key
        const result = await deleteTaskById(taskId);

        if (result) {
            // Task deleted successfully
            res.status(200).json({ message: 'Task deleted successfully' });
        } else {
            // Task not found or deletion failed
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to delete a task by its ID
async function deleteTaskById(taskId) {
    return new Promise((resolve, reject) => {
        // Replace 'contact_submissions' with the actual name of your table
        const deleteQuery = 'DELETE FROM contact_submissions WHERE id = ?';

        db.run(deleteQuery, [taskId], function (err) {
            if (err) {
                console.error('Error deleting task from the database:', err);
                reject(err);
            } else {
                // Check if any rows were affected (task deleted)
                const rowsAffected = this.changes;
                resolve(rowsAffected > 0);
            }
        });
    });
}

// Admin actions on the user



app.delete('/api/users/:id', isAdminAuthenticated, async (req, res) => {
    const userId = req.params.id;

    try {
        // Delete the user from the database
        const query = 'DELETE FROM Users WHERE ID = ?';
        db.run(query, [userId], function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ message: 'Internal Server Error' });
            }

            // Check if a user was actually deleted
            if (this.changes === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({ message: 'User deleted successfully' });
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// API endpoint to fetch user details by ID
app.get('/api/userModify/:userId', isAdminAuthenticated, (req, res) => {
    const userId = req.params.userId;

    // Replace the following with your database query to get user details
    // This is a placeholder; adjust it based on your actual database structure and queries
    const query = 'SELECT * FROM Users WHERE ID = ?';
    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Error fetching user details:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (!row) {
            console.error('User not found:', userId);
            return res.status(404).json({ message: 'User not found' });
        }

        // Assuming your user details include fields like 'username', 'email', 'password', and 'userid'
        const userDetails = {
            username: row.Username,
            email: row.Email,
            password: row.Password,  // Note: Sending the password to the client is not recommended; this is just an example
            userid: row.ID,
        };

        res.json(userDetails);
    });
});


// Update user details endpoint
app.put('/api/users/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { username, email, password } = req.body;

    // Construct the SET clause of the SQL query based on provided values
    let setClause = '';
    const values = [];

    if (username) {
        setClause += 'username = ?, ';
        values.push(username);
    }

    if (email && isValidEmail(email)) {
        setClause += 'email = ?, ';
        values.push(email);
    }

    if (password) {
        // Check if the password is a non-empty string
        if (typeof password === 'string' && password.trim().length > 0) {
            // Hash the new password using await
            const hashedPassword = await bcrypt.hash(password, 10);
            setClause += 'password = ?, ';
            values.push(hashedPassword);
        }
    }

    // Trim the trailing comma and space from setClause
    setClause = setClause.replace(/,\s*$/, '');

    // Update the user details in the database
    db.run(
        `UPDATE users SET ${setClause} WHERE ID = ?`,
        [...values, userId],
        async (err) => {
            if (err) {
                console.error('Error updating user details:', err.message);
                res.status(500).send({ error: 'Internal Server Error' });
            } else {
                // Retrieve the updated user details from the database
                db.get(
                    'SELECT * FROM users WHERE ID = ?',
                    [userId],
                    (err, row) => {
                        if (err) {
                            console.error('Error fetching updated user details:', err.message);
                            res.status(500).send({ error: 'Internal Server Error' });
                        } else {
                            console.log('User details updated successfully.');
                            res.json(row); // Respond with the updated user details
                        }
                    }
                );
            }
        }
    );
});


// Function to check if an email is valid
function isValidEmail(email) {
    // For simplicity, a basic regex pattern is used
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}







// API for File Mgmt


// Multer storage setup
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

// Route to handle both POST and PUT requests for file and URL uploads
app.route('/file-upload')
    // POST request for file upload
    .post(upload.single('file'), async (req, res) => {
        try {
            if (req.file) {
                const { originalname, buffer, mimetype } = req.file;
                const userId = req.session.userId;
                const image_id = req.body.image_id; // Get the image ID from the request body
                const image_description = req.body.image_description;


                const result = await insertFileMetadata(originalname, buffer, mimetype, userId, image_id, image_description);
                res.json({ message: 'File uploaded successfully', fileId: result.id });
            } else {
                res.status(400).json({ error: 'Missing file' });
            }
        } catch (err) {
            console.error('Error uploading file:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    })
    // PUT request for file update
    .put(upload.single('file'), async (req, res) => {
        try {
            if (req.file) {
                const { originalname, buffer, mimetype } = req.file;
                const userId = req.session.userId;
                const image_id = req.body.image_id; // Get the image ID from the request body
                const image_description = req.body.image_description;

                console.log("userId: " + userId + " imageId: " + image_id + " description: " + image_description);


                const result = await updateFileMetadata(originalname, buffer, mimetype, userId, image_id, image_description);
                res.json({ message: 'File updated successfully', fileId: result.id });
            } else {
                res.status(400).json({ error: 'Missing file' });
            }
        } catch (err) {
            console.error('Error updating file:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    })
    // POST request for URL upload
    .post(async (req, res) => {
        try {
            const { file_url, image_id, image_description } = req.body;
            const userId = req.session.userId;



            const result = await insertFileUrl(file_url, userId, image_id, image_description);
            res.json({ message: 'URL uploaded successfully', fileId: result.id });
        } catch (err) {
            console.error('Error uploading URL:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    })
    // PUT request for URL update
    .put(async (req, res) => {
        try {
            const { file_url, image_id, image_description } = req.body;
            const userId = req.session.userId;

            console.log("userId: " + userId + " imageId: " + image_id + " description: " + image_description + "file_url: " + file_url);


            const result = await updateFileUrl(file_url, userId, image_id, image_description);
            res.json({ message: 'URL updated successfully', fileId: result.id });
        } catch (err) {
            console.error('Error updating URL:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });



// Function to insert file metadata into the database
function insertFileMetadata(filename, buffer, mimetype, userId, image_id, image_description) {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO files (filename, data, mimetype, user_id, image_id, image_description) VALUES (?, ?, ?, ?, ?, ?)';

        db.run(query, [filename, buffer, mimetype, userId, image_id, image_description], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
}

function insertFileUrl(url, userId, image_id, image_description) {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO files (file_url, user_id, image_id, image_description) VALUES (?, ?, ?, ?)';
        db.run(query, [url, userId, image_id, image_description], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID });
            }
        });
    });
}

// Function to update file URL in the database
async function updateFileUrl(url, userId, image_id, image_description) {
    // Your database update logic here
    const sqlUpdateUrl = `UPDATE files SET file_url = ?, image_description = ? WHERE image_id = ? AND user_id = ?`;
    const paramsUpdateUrl = [url, image_description, image_id, userId];

    return new Promise((resolve, reject) => {
        db.run(sqlUpdateUrl, paramsUpdateUrl, function (err) {
            if (err) {
                console.error('Error updating image URL:', err);
                reject(err);
            } else {
                console.log(`Image URL updated successfully: ${url}`);
                resolve({ id: this.lastID });
            }
        });
    });
}


// Function to update file metadata in the database
async function updateFileMetadata(originalname, buffer, mimetype, userId, image_id, image_description) {
    const sqlUpdateMetadata = `UPDATE files SET filename = ?, data = ?, mimetype = ?, image_description = ? WHERE image_id = ? AND user_id = ?`;
    const paramsUpdateMetadata = [originalname, buffer, mimetype, image_description, image_id, userId];

    try {
        const result = await db.run(sqlUpdateMetadata, paramsUpdateMetadata);
        console.log('File metadata updated successfully');
        return { id: result.lastID };
    } catch (err) {
        console.error('Error updating file metadata:', err);
        throw err; // Throw the error to propagate it to the caller
    }
}












// Endpoint to handle file requests
app.get('/file/:filename', async (req, res) => {
    const filename = req.params.filename;

    try {
        // Check if the filename is a URL
        if (filename.startsWith('http')) {
            res.redirect(filename); // Redirect to the URL
        } else {
            // Fetch file data from the database based on the filename
            db.get('SELECT data, mimetype FROM files WHERE filename = ?', [filename], (err, row) => {
                if (err) {
                    console.error('Error fetching file data:', err);
                    return res.status(500).send('Internal Server Error');
                }

                if (!row) {
                    console.error('File not found:', filename);
                    return res.status(404).send('File not found');
                }

                // Set the appropriate content type based on the mimetype
                res.setHeader('Content-Type', row.mimetype);

                // Send the file data
                res.send(row.data);
            });
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Route handler for /api/fileUrl
app.post('/api/fileUrl', (req, res) => {
    const { user_id, file_url, image_id, image_description } = req.body;

    // Update the files table with the new URL
    db.run(`INSERT INTO files (user_id, file_url, image_id, image_description) VALUES (?, ?, ?, ?)`,
        [user_id, file_url, image_id, image_description],
        (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: 'Database update failed' });
            } else {
                res.status(200).json({ message: 'URL updated successfully' });
            }
        });
});

// Route handler for /api/fileUrl
app.put('/api/fileUrl', (req, res) => {
    const { image_id, image_description } = req.body;

    // Update the files table with the new URL
    db.run(`UPDATE  files SET image_description = ? WHERE image_id = ?`,
        [image_description, image_id],
        (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: 'Database update failed' });
            } else {
                res.status(200).json({ message: 'URL updated successfully' });
            }
        });
});




// Route handler to fetch all images for a user
app.get('/api/getAllImages/:user_id', async (req, res) => {
    const userId = req.params.user_id;

    try {
        // Query the database to get all images for the user
        const sqlQuery = `SELECT * FROM files WHERE user_id = ?`;
        db.all(sqlQuery, [userId], (err, rows) => {
            if (err) {
                console.error('Error fetching images from the database:', err);
                res.status(500).json({ error: 'Failed to fetch images.' });
            } else {
                // Send the fetched image data as JSON response
                res.status(200).json(rows);
            }
        });
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: 'Failed to fetch images.' });
    }
});


app.delete('/api/deleteImage/:image_id', async (req, res) => {
    try {
        const image_id = req.params.image_id;
        // Perform deletion operation using image_id
        await deleteImageFromDatabase(image_id); // Implement this function to delete image from database

        res.json({ message: 'Image deleted successfully' });
    } catch (err) {
        console.error('Error deleting image:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to delete an image from the database based on its ID
async function deleteImageFromDatabase(image_id) {
    return new Promise((resolve, reject) => {
        // Construct the SQL query to delete the row with the specified image ID
        const sql = `DELETE FROM files WHERE image_id = ?`;

        // Execute the SQL query with the image ID parameter
        db.run(sql, [image_id], function (err) {
            if (err) {
                console.error('Error deleting image:', err);
                reject(err);
            } else {
                console.log(`Image with ID ${image_id} deleted successfully`);
                resolve(true);
            }
        });
    });
}

// Express route to update image description
app.put('/api/files/description/:id', async (req, res) => {
    try {
        const image_id = req.params.id;
        const { image_description } = req.body;

        console.log(`Attempt for update: ${image_id}, ${image_description} `)
        db.run(`UPDATE files SET image_description = ? WHERE image_id = ?`, [image_description, image_id])

    } catch (err) {
        console.error('Error updating image description:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});








// Managing saves for social media buttons


// POST endpoint to save a social media button for a user
app.post('/api/socialMedia', (req, res) => {
    console.log('Received request:', req.body);
    const { button_id, user_id, platform, url, color1, color2, direction } = req.body;
    const insertQuery = 'INSERT INTO social_media_buttons (button_id, user_id, platform, url, color1, color2, direction) VALUES (?, ?, ?, ?, ?, ?, ?)';

    db.run(insertQuery, [button_id, user_id, platform, url, color1, color2, direction], function (err) {
        if (err) {
            console.error('Error saving to database:', err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send a success response if the operation is completed without errors
        res.json({ success: true });
    });
});
// GET endpoint to retrieve all social media buttons for a user
app.get('/api/socialMedia/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const query = 'SELECT * FROM social_media_buttons WHERE user_id = ?';
    db.all(query, [user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// PUT endpoint to update a social media button
app.put('/api/socialMedia/:userId/:buttonId', (req, res) => {
    const { userId, buttonId } = req.params;
    const { platform, url, color1, color2, direction } = req.body;

    // Use a transaction to perform both DELETE and INSERT automatically
    db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
            console.error('Error beginning transaction:', beginErr);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // DELETE the old button's data
        db.run(
            'DELETE FROM social_media_buttons WHERE user_id = ? AND button_id = ?',
            [userId, buttonId],
            (deleteErr) => {
                if (deleteErr) {
                    console.error('Error deleting old button data:', deleteErr);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                // INSERT the new button's data
                db.run(
                    'INSERT INTO social_media_buttons (user_id, button_id, platform, url, color1, color2, direction) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [userId, buttonId, platform, url, color1, color2, direction],
                    (insertErr) => {
                        if (insertErr) {
                            console.error('Error inserting new button data:', insertErr);
                            res.status(500).json({ error: 'Internal Server Error' });
                            return;
                        }

                        // Commit the transaction
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                console.error('Error committing transaction:', commitErr);
                                res.status(500).json({ error: 'Internal Server Error' });
                                return;
                            }

                            res.json({ message: 'Button updated successfully' });
                        });
                    }
                );
            }
        );
    });
});





// DELETE endpoint to delete a social media button
app.delete('/api/socialMedia/:button_id', async (req, res) => {
    const button_id = req.params.button_id;

    console.log('Attempting to delete button with ID:', button_id);

    const checkQuery = 'SELECT * FROM social_media_buttons WHERE button_id = ?';
    const deleteQuery = 'DELETE FROM social_media_buttons WHERE button_id = ?';

    try {
        // Check if the button with the given ID exists
        const existingButton = await new Promise((resolve, reject) => {
            db.get(checkQuery, [button_id], (err, row) => {
                if (err) {
                    console.error('Error checking button existence:', err.message);
                    return reject(err);
                }

                resolve(row);
            });
        });

        if (!existingButton) {
            // If the button doesn't exist, respond with a bad request status
            return res.status(400).json({ error: 'Button not found' });
        }

        // Delete the button from the database
        await new Promise((resolve, reject) => {
            db.run(deleteQuery, [button_id], function (err) {
                if (err) {
                    console.error('Error deleting from the database:', err.message);
                    return reject(err);
                }

                console.log('Button deleted from the database.');
                resolve();
            });
        });

        // If deletion is successful, respond with a success status
        res.status(200).json({ message: 'Button deleted successfully' });
    } catch (error) {
        console.error('Error during deletion:', error);
        res.status(500).json({ error: 'Failed to delete the button' });
    }
});




/*
*
*
*
* 
*
*
*
*
*/



// User info modal management

// Endpoint to save or update user information
app.post('/api/UserInfo/Change', (req, res) => {
    const { userId, pageInfo } = req.body;

    // Check if the user already has an info section
    const checkQuery = 'SELECT COUNT(*) as count FROM user_text_info WHERE user_id = ?';
    db.get(checkQuery, [userId], (err, row) => {
        if (err) {
            console.error('Error checking data:', err);
            res.status(500).json({ message: 'Internal Server Error' });
        } else {
            const count = row ? row.count : 0;

            if (count > 0) {
                // User already has an info section, update it
                const updateQuery = 'UPDATE user_text_info SET page_info = ? WHERE user_id = ?';
                db.run(updateQuery, [pageInfo, userId], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating data:', updateErr);
                        res.status(500).json({ message: 'Internal Server Error' });
                    } else {
                        res.status(200).json({ message: 'Data updated successfully!' });
                    }
                });
            } else {
                // User doesn't have an info section, insert new data
                const insertQuery = 'INSERT INTO user_text_info (user_id, page_info) VALUES (?, ?)';
                db.run(insertQuery, [userId, pageInfo], (insertErr) => {
                    if (insertErr) {
                        console.error('Error inserting data:', insertErr);
                        res.status(500).json({ message: 'Internal Server Error' });
                    } else {
                        res.status(200).json({ message: 'Data saved successfully!' });
                    }
                });
            }
        }
    });
});

// Endpoint to retrieve user information
app.get('/api/UserInfo/:userId', (req, res) => {
    const userId = req.params.userId;

    const query = 'SELECT page_info FROM user_text_info WHERE user_id = ?';
    db.get(query, [userId], (err, row) => {
        if (err) {
            console.error('Error fetching data:', err);
            res.status(500).json({ message: 'Internal Server Error' });
        } else {
            const pageInfo = row ? row.page_info : null;
            res.status(200).json({ pageInfo });
        }
    });
});




/*
*
*
*
*
*
*
*
*
*
*
*
*
*
*
*/


// Management for profile pictures


// Create 'pfp' table if not exists
db.run(`
    CREATE TABLE IF NOT EXISTS pfp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        imageData BLOB NOT NULL,
        FOREIGN KEY (user_id) REFERENCES Users(ID)
    );
`);


// Set up the route for file upload
app.post('/api/pfp/upload', upload.single('imageData'), async (req, res) => {
    const userId = req.body.userId;
    const imageDataBuffer = req.file.buffer;

    try {
        // Check if the user already has a profile picture
        const existingUser = await getProfilePicture(userId);

        if (existingUser) {
            // User already exists, update the imageData
            db.run(
                'UPDATE pfp SET imageData = ? WHERE user_id = ?',
                [imageDataBuffer, userId],
                function (error) {
                    if (error) {
                        console.error('Error updating profile picture:', error);
                        res.status(500).json({ error: 'Internal Server Error', details: error.message });
                    } else {
                        console.log('Update successful');
                        res.json({ success: true });
                    }
                }
            );
        } else {
            // User doesn't exist, insert new profile picture
            db.run(
                'INSERT INTO pfp (user_id, imageData) VALUES (?, ?)',
                [userId, imageDataBuffer],
                function (error) {
                    if (error) {
                        console.error('Error uploading profile picture:', error);
                        res.status(500).json({ error: 'Internal Server Error', details: error.message });
                    } else {
                        console.log('Upload successful');
                        res.json({ success: true });
                    }
                }
            );
        }
    } catch (error) {
        console.error('Unexpected error during file upload:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});



// In your server code
app.get('/api/pfp/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const result = await getProfilePicture(userId);

        if (result) {
            // Set the content type to image/jpeg (adjust based on your image type)
            res.contentType('image/jpeg');

            // Send the binary data as a response
            res.send(result.imageData);
        } else {
            res.status(404).json({ error: 'Profile picture not found' });
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);

        // Log the error details
        console.error(error);

        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// Function to get profile picture data from the database
async function getProfilePicture(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT imageData FROM pfp WHERE user_id = ?', [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}




// Profile stats

app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT Email, Username, Membership FROM Users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (!row) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(row);
    });
});




// API Route to get user data for dynamic rendering of cards


// Define route to fetch user data
// API Route to get user data for dynamic rendering of cards


// In your server code
app.get('/api/pfp/all', async (req, res) => {
    try {
        const results = await getAllProfilePictures();

        if (results.length > 0) {
            // Set the content type to image/jpeg (adjust based on your image type)
            res.contentType('image/jpeg');

            // Send the binary data as a response
            res.send(results);
        } else {
            res.status(404).json({ error: 'Profile pictures not found' });
        }
    } catch (error) {
        console.error('Error fetching profile pictures:', error);

        // Log the error details
        console.error(error);

        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// Function to get all profile pictures data from the database
async function getAllProfilePictures() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT Users.ID as userId, Users.Username, pfp.imageData 
            FROM Users 
            LEFT JOIN pfp ON Users.ID = pfp.user_id
        `;

        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}








// Save background settings
app.post('/api/background', (req, res) => {
    const { user_id, method, staticColor, gradientStart, gradientEnd, gradientDirection, imageUrl, imageData } = req.body;

    // Clear existing background settings for the user
    db.run(`DELETE FROM background WHERE user_id = ?;`, [user_id], (err) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to save background settings.' });
        } else {
            // Insert new background settings into the database
            db.run(`
                INSERT INTO background (user_id, method, static_color, gradient_start, gradient_end, gradient_direction, image_url, imageData)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            `, [user_id, method, staticColor, gradientStart, gradientEnd, gradientDirection, imageUrl, imageData], (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ error: 'Failed to save background settings.' });
                } else {
                    res.status(200).json({ message: 'Background settings saved successfully.' });
                }
            });
        }
    });
});

// POST request to handle image uploads and URL submissions
app.post('/api/background/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        // If an image file is uploaded
        const imageData = req.file.buffer;
        // Store the image data as a BLOB in the database
        db.run(`
            INSERT INTO background (user_id, method, imageData)
            VALUES (?, 'image', ?);
        `, [req.body.user_id, imageData], (err) => {
            if (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to upload image.' });
            } else {
                res.status(200).json({ success: true, message: 'Image uploaded successfully.' });
            }
        });
    } else if (req.body.imageUrl) {
        // If an image URL is provided
        // Display the image directly
        // Apply image to background
        applyImage(req.body.imageUrl);
        // Save imageURL to the backend along with imageData set to null
        saveBackgroundSettings('image', null, null, null, null, req.body.imageUrl, null);
        res.status(200).json({ success: true, message: 'Image URL saved successfully.' });
    } else {
        res.status(400).json({ error: 'No image uploaded or URL provided.' });
    }
});







// Load background settings
app.get('/api/background/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT * FROM background WHERE user_id = ?;', [userId], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to load background settings.' });
        } else {
            res.status(200).json(row || {});
        }
    });
});




// Text Field CRUD



// Route to create a new text field card
app.post('/api/textfield/create', (req, res) => {
    const { user_id, TextField_id, content } = req.body;

    db.run(`INSERT INTO TextFields (user_id, TextField_id, content) VALUES (?, ?, ?)`, [user_id, TextField_id, content], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.status(201).json({ message: 'Text field card created successfully', id: this.lastID });
    });
});

// Route to retrieve all text field cards for a specific user
app.get('/api/textfields/:user_id', (req, res) => {
    const user_id = req.params.user_id;

    db.all(`SELECT * FROM TextFields WHERE user_id = ?`, [user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.status(200).json(rows);
    });
});

// Route to update a text field card
app.put('/api/textfields/update/:id', (req, res) => {
    const { content, cardId } = req.body;

    db.run(`UPDATE TextFields SET content = ? WHERE TextField_id = ?`, [content, cardId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.status(200).json({ message: 'Text field card updated successfully' });
    });
});



// Route to delete a text field card
app.delete('/api/textfields/delete/:id', (req, res) => {
    const TextField_id = req.params.id; // Access TextField_id from the URL parameter

    db.run(`DELETE FROM TextFields WHERE TextField_id = ?`, [TextField_id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.status(200).json({ message: 'Text field card deleted successfully' });
    });
});





// Route for creating a new button
app.post('/api/button/create', async (req, res) => {
    try {
        const { userId, button_id, buttonText, buttonLink, preset, styleStrength, fillColor, textColor, softShadowX, softShadowY, softShadowSpread, hardShadowX, hardShadowY, outlineWidth, outlineColor } = req.body;



        // Insert the new button into the database
        db.run(`
            INSERT INTO Buttons (user_id, button_id, buttonText, buttonLink, preset, styleStrength, fillColor, textColor, softShadowX, softShadowY, softShadowSpread, hardShadowX, hardShadowY, outlineWidth, outlineColor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, button_id, buttonText, buttonLink, preset, styleStrength, fillColor, textColor, softShadowX, softShadowY, softShadowSpread, hardShadowX, hardShadowY, outlineWidth, outlineColor], function (err) {
            if (err) {
                console.error('Error creating button:', err);
                res.status(500).send('Error creating button.');
            } else {
                res.status(200).send('Button created successfully.');
            }
        });
    } catch (error) {
        console.error('Error creating button:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
});


// GET route for  getting all buttons in the database
app.get('/api/buttons/:user_id', async (req, res) => {
    const { user_id } = req.params; // Access user_id from request parameters
    try {
        // Fetch all buttons from the database for the specified user_id
        db.all('SELECT * FROM Buttons WHERE user_id = ?', [user_id], (err, rows) => {
            if (err) {
                console.error('Error fetching buttons:', err);
                res.status(500).send('Error fetching buttons.');
            } else {
                // Send the fetched buttons data as a JSON response
                res.status(200).json(rows);
            }
        });
    } catch (error) {
        console.error('Error fetching buttons:', error);
        res.status(500).send('An error occurred. Please try again later.');
    }
});




// Update button data route
app.put('/api/button/update/:button_id', (req, res) => {
    const button_id = req.params.button_id;
    const {
        buttonText,
        buttonLink,
        preset,
        styleStrength,
        fillColor,
        textColor,
        softShadowX,
        softShadowY,
        softShadowSpread,
        hardShadowX,
        hardShadowY,
        outlineWidth,
        outlineColor
    } = req.body;

    // Update the button data in the database
    db.run(`UPDATE Buttons
            SET buttonText = ?, buttonLink = ?, preset = ?, styleStrength = ?,
                fillColor = ?, textColor = ?, softShadowX = ?, softShadowY = ?,
                softShadowSpread = ?, hardShadowX = ?, hardShadowY = ?,
                outlineWidth = ?, outlineColor = ?
            WHERE button_id = ?`,
        [buttonText, buttonLink, preset, styleStrength, fillColor, textColor,
            softShadowX, softShadowY, softShadowSpread, hardShadowX, hardShadowY,
            outlineWidth, outlineColor, button_id],
        (err) => {
            if (err) {
                console.error('Error updating button:', err);
                res.status(500).json({ error: 'Failed to update button.' });
            } else {
                res.status(200).json({ message: 'Button updated successfully.' });
            }
        });
});



// Delete button route
app.delete('/api/button/delete/:button_id', (req, res) => {
    const button_id = req.params.button_id;

    // Delete the button from the database
    db.run(`DELETE FROM Buttons WHERE button_id = ?`, [button_id], (err) => {
        if (err) {
            console.error('Error deleting button:', err);
            res.status(500).json({ error: 'Failed to delete button.' });
        } else {
            res.status(200).json({ message: 'Button deleted successfully.' });
        }
    });
});

// Route to update all the buttons via the selected preset and style strength (on the design section)
app.put('/api/buttons/update/:userId', (req, res) => {
    const { userId } = req.params;
    const { preset, styleStrength } = req.body;

    // Update the Buttons table based on the user ID, preset, and style strength
    const updateQuery = `UPDATE Buttons SET preset = ?, styleStrength = ? WHERE user_id = ?`;

    db.run(updateQuery, [preset, styleStrength, userId], function (err) {
        if (err) {
            console.error('Error updating Buttons:', err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            console.log(`Buttons updated for user ID ${userId}`);
            res.status(200).json({ message: 'Buttons updated successfully' });
        }
    });
});




// Global styles routes


// Route to add or update global styles
app.post('/api/style/add', (req, res) => {
    const { user_id, button_color, text_color, shadow_color, button_font } = req.body;

    // Check if there are existing values for the given user_id
    db.get('SELECT * FROM Global_Styles WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            console.error('Error checking existing values:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // If there are existing values, update them; otherwise, insert new values
        if (row) {
            db.run('UPDATE Global_Styles SET button_color = ?, text_color = ?, shadow_color = ?, button_font = ? WHERE user_id = ?', [button_color, text_color, shadow_color, button_font, user_id], (err) => {
                if (err) {
                    console.error('Error updating global styles:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(200).json({ message: 'Global styles updated successfully' });
            });
        } else {
            db.run('INSERT INTO Global_Styles (user_id, button_color, text_color, shadow_color, button_font) VALUES (?, ?, ?, ?, ?)', [user_id, button_color, text_color, shadow_color, button_font], (err) => {
                if (err) {
                    console.error('Error adding global styles:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.status(200).json({ message: 'Global styles added successfully' });
            });
        }
    });
});


// Route to get global styles by user_id
app.get('/api/style/:user_id', (req, res) => {
    const { user_id } = req.params;

    // Check if there are existing values for the given user_id
    db.get('SELECT * FROM Global_Styles WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            console.error('Error fetching global styles:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (row) {
            const { button_color, text_color, shadow_color, button_font } = row;
            res.status(200).json({ button_color, text_color, shadow_color, button_font });
        } else {
            res.status(404).json({ error: 'Global styles not found for the user' });
        }
    });
});




app.get('/:username', (req, res) => {
    const username = String(req.params.username);
    res.render('user-page', { username: username });
})


// Define the route to fetch user_id based on username
app.get('/api/getUserId', (req, res) => {
    const username = req.query.username; // Get the username from the query parameters

    // Query the database to fetch user_id based on username
    const query = `SELECT ID FROM Users WHERE username = ?`;
    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Error fetching user ID:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (row && row.ID) {
                res.json({ user_id: row.ID }); // Send the user_id back to the client
            } else {
                res.status(404).json({ error: 'User ID not found for the provided username' });
            }
        }
    });
});



// Define the route for batch update
app.put('/api/apply-preset/:userId', (req, res) => {
    const userId = req.params.userId; // Get the user ID from the URL parameter
    const presetData = req.body.presetData; // Get the preset data from the request body

    try {
        // Start a transaction
        db.run('BEGIN TRANSACTION;');

        // Update buttons table based on the selected preset and style strength
        db.run(`
            UPDATE Buttons
            SET
                preset = ?,
                styleStrength = ?,
                fillColor = ?,
                textColor = ?,
                softShadowX = ?,
                softShadowY = ?,
                softShadowSpread = ?,
                hardShadowX = ?,
                hardShadowY = ?,
                outlineWidth = ?,
                outlineColor = ?
            WHERE user_id = ?;
        `, [
            presetData.buttons.preset,
            presetData.buttons.styleStrength,
            presetData.buttons.fillColor,
            presetData.buttons.textColor,
            presetData.buttons.softShadowX,
            presetData.buttons.softShadowY,
            presetData.buttons.softShadowSpread,
            presetData.buttons.hardShadowX,
            presetData.buttons.hardShadowY,
            presetData.buttons.outlineWidth,
            presetData.buttons.outlineColor,
            userId
        ]);

        // Update globalStyles table based on the selected preset's global styles
        db.run(`
            UPDATE Global_Styles
            SET
                button_color = ?,
                text_color = ?,
                shadow_color = ?,
                button_font = ?
            WHERE user_id = ?;
        `, [
            presetData.globalStyles.button_color,
            presetData.globalStyles.text_color,
            presetData.globalStyles.shadow_color,
            presetData.globalStyles.button_font,
            userId
        ]);

        // Update background table based on the selected preset's background
        db.run(`
            UPDATE background
            SET
                method = ?,
                static_color = ?,
                gradient_start = ?,
                gradient_end = ?,
                gradient_direction = ?,
                image_url = ?
            WHERE user_id = ?;
        `, [
            presetData.background.method,
            presetData.background.static_color,
            presetData.background.gradient_start,
            presetData.background.gradient_end,
            presetData.background.gradient_direction,
            presetData.background.imageUrl,
            userId
        ]);

        // Update social_media_buttons table based on the selected preset's social media buttons
        db.run(`
            UPDATE social_media_buttons
            SET
                color1 = ?,
                color2 = ?,
                direction = ?
            WHERE user_id = ?;
        `, [
            presetData.socialMediaButtons.color1,
            presetData.socialMediaButtons.color2,
            presetData.socialMediaButtons.direction,
            userId
        ]);

        // Commit the transaction
        db.run('COMMIT;');

        // Send a success response
        res.status(200).send('Preset applied successfully');
    } catch (error) {
        console.error('Error applying preset:', error);

        // Rollback the transaction on error
        db.run('ROLLBACK;');

        // Send an error response
        res.status(500).send('Error applying preset');
    }
});










// Now, you can handle other 404 cases or define your regular routes below this middleware
app.use((req, res) => {
    res.status(404).render('404'); // Assuming '404' is the name of your 404 page
});

// Close the database connection when the application exits
process.on('exit', () => {
    db.close();
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
    console.log('http://localhost:3000');
});


