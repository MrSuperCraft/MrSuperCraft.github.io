-- Create a table
CREATE TABLE IF NOT EXISTS Users (
    ID INTEGER PRIMARY KEY,
    Username TEXT,
    Email TEXT,
    Password TEXT,
    isAdmin BOOLEAN
);

-- Update a user

-- UPDATE contact_submissions
-- SET status = 'Completed'
-- WHERE Email = "james.anderson@example.com";

-- Delete a user
-- DELETE FROM Users WHERE Email="123@gmail.com";


CREATE TABLE IF NOT EXISTS settings (
    setting_name TEXT,
    setting_value TEXT
);


CREATE TABLE IF NOT EXISTS contact_submissions (
    name TEXT,
    Email TEXT,
    Topic TEXT,
    Title TEXT,
    Message TEXT,
    Status TEXT
);


-- DROP TABLE files;

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,
    filename TEXT,
    data BLOB,
    mimetype TEXT,
    user_id INTEGER NOT NULL REFERENCES Users(ID),
    file_url TEXT,
    image_description TEXT
);




-- set status: UPDATE contact_submissions SET status = 'Pending';

--INSERT INTO Users (Email, Password, Username, isAdmin)
--VALUES
--('123@gmail.com', '$2a$10$0NtO.PpvJXqJ0gbKl/zIDOCSj37u2YnMZ97CzBQltA5Uox6PLcGK.', 'MrSuperCraft', 1),
--('admin@linkserv.com' , '$2a$10$sbtrTRVjQURahG1O54Ll5.34Ccz/N3myw0ce7Pahz62j.ruV7o9kG', 'Admin', 1);
-- ('user3@example.com', '$2b$10$YourHashedPassword3', 'user3', 0);
--   ('user4@example.com', '$2b$10$YourHashedPassword4', 'user4', 0),
--   ('user5@example.com', '$2b$10$YourHashedPassword5', 'user5', 0),
--   ('user6@example.com', '$2b$10$YourHashedPassword6', 'user6', 0),
--   ('user7@example.com', '$2b$10$YourHashedPassword7', 'user7', 0),
--   ('user8@example.com', '$2b$10$YourHashedPassword8', 'user8', 0),
--   ('user9@example.com', '$2b$10$YourHashedPassword9', 'user9', 0),
--   ('user10@example.com', '$2b$10$YourHashedPassword10', 'user10', 0),
--   ('user11@example.com', '$2b$10$YourHashedPassword11', 'user11', 0),
--   ('user12@example.com', '$2b$10$YourHashedPassword12', 'user12', 0),
--   ('user13@example.com', '$2b$10$YourHashedPassword13', 'user13', 0),
--   ('user14@example.com', '$2b$10$YourHashedPassword14', 'user14', 0),
--   ('user15@example.com', '$2b$10$YourHashedPassword15', 'user15', 0),
--   ('user16@example.com', '$2b$10$YourHashedPassword16', 'user16', 0),
--   ('user17@example.com', '$2b$10$YourHashedPassword17', 'user17', 0),
--   ('user18@example.com', '$2b$10$YourHashedPassword18', 'user18', 0),
--   ('user19@example.com', '$2b$10$YourHashedPassword19', 'user19', 0),
--   ('user20@example.com', '$2b$10$YourHashedPassword20', 'user20', 0),
--   ('user21@example.com', '$2b$10$YourHashedPassword21', 'user21', 0),
--   ('user22@example.com', '$2b$10$YourHashedPassword22', 'user22', 0),
--   ('user23@example.com', '$2b$10$YourHashedPassword23', 'user23', 0),
--   ('user24@example.com', '$2b$10$YourHashedPassword24', 'user24', 0),
--   ('user25@example.com', '$2b$10$YourHashedPassword25', 'user25', 0),
--   ('user26@example.com', '$2b$10$YourHashedPassword26', 'user26', 0),
--   ('user27@example.com', '$2b$10$YourHashedPassword27', 'user27', 0),
--   ('user28@example.com', '$2b$10$YourHashedPassword28', 'user28', 0),
--   ('user29@example.com', '$2b$10$YourHashedPassword29', 'user29', 0),
--   ('user30@example.com', '$2b$10$YourHashedPassword30', 'user30', 0);


CREATE TABLE IF NOT EXISTS social_media_buttons (
    button_id INT PRIMARY KEY,
    user_id INT,
    platform VARCHAR(50) NOT NULL,
    url VARCHAR(255) NOT NULL,
    color1 VARCHAR(7) NOT NULL, -- Hex color code for color1
    color2 VARCHAR(7) NOT NULL, -- Hex color code for color2
    direction VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(ID)
  );  


CREATE TABLE IF NOT EXISTS user_text_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  page_info TEXT,
  FOREIGN KEY (user_id) REFERENCES Users(ID)
);


-- Testing
-- DELETE FROM social_media_buttons WHERE user_id="3";


-- Set the 'Membership' date for all users to the current date
-- UPDATE Users
-- SET Membership = strftime('%m/%d/%Y', 'now');


CREATE TABLE IF NOT EXISTS background (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    method TEXT,
    static_color TEXT,
    gradient_start TEXT,
    gradient_end TEXT,
    gradient_direction TEXT,
    image_url TEXT,
    imageData BLOB,
    FOREIGN KEY (user_id) REFERENCES Users(ID)
);




CREATE TABLE IF NOT EXISTS TextFields (
    ID INTEGER PRIMARY KEY,
    TextField_id  INTEGER, -- This is used as a unique identifier for each text field.
    user_id INTEGER REFERENCES Users(ID),
    content TEXT
);



CREATE TABLE IF NOT EXISTS Buttons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES Users(ID),
    button_id INTEGER, -- This is used as a unique identifier for each button.
    buttonText TEXT NOT NULL,
    buttonLink TEXT NOT NULL,
    preset TEXT NOT NULL,
    styleStrength INTEGER NOT NULL,
    fillColor TEXT,
    textColor TEXT,
    softShadowX INTEGER,
    softShadowY INTEGER,
    softShadowSpread INTEGER,
    hardShadowX INTEGER,
    hardShadowY INTEGER,
    outlineWidth INTEGER,
    outlineColor TEXT
);


CREATE TABLE IF NOT EXISTS Global_Styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES Users(ID),
    button_color TEXT NOT NULL,
    text_color TEXT NOT NULL,
    shadow_color TEXT NOT NULL,
    button_font TEXT NOT NULL
);





-- View the table data
SELECT * FROM Users;
SELECT * FROM contact_submissions;
SELECT * FROM settings;
SELECT * FROM files;
SELECT * FROM social_media_buttons;
SELECT * FROM user_text_info;
SELECT * FROM background;
SELECT * FROM TextFields;
SELECT * FROM Buttons;
SELECT * FROM Global_Styles;