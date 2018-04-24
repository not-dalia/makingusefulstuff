var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var aws = require('aws-sdk')
var multer = require('multer')
var multerS3 = require('multer-s3')
var mysql = require('mysql');
const fs = require('fs');

const NOUNS = ["3DPrinter", "Maker", "Inventor", "Creator", "Scientist", "Engineer", "Designer", "Programmer", "Robot", "LaserCutter", "Knitter", "Chip", "Ink", "Electron", "Proton", "Artist", "Arduino", "Hacker", "Button", "Sensor", "PowerSupply", "Transistor", "Resistor", "Capacitor", "LED", "Coil", "Motor", "Actuator", "Ribbon", "Pin", "Scissors", "Filament", "Thimble", "Needle", "Hammer"];
const ADJECTIVES = ["Antimatter", "Crafty", "Terrific", "Ubiquitous", "Rebellious", "Efficacious", "Fastidious", "Jocular", "Playful", "Nefarious", "Zealous", "Ambiguous", "Auspicious", "Berserk", "Bustling", "Calculating", "Colossal", "Decisive", "Dynamic", "Elastic", "Ethereal", "Exuberant", "Fabulous", "Fearless", "Grandiose", "Harmonious", "Hypnotic", "Incandescent", "Invincible", "Nebulous", "Nimble", "Omniscient", "Quirky", "Stupendous", "Thundering", "Whimsical", "Malevolent", "Spooky", "Majestic", "Epic", "Humble"];



var connection = mysql.createConnection({
    host: process.env.AWS_DB_HOST,
    user: process.env.AWS_DB_USER,
    password: process.env.AWS_DB_PASS,
    database: process.env.AWS_DB_NAME,
    ssl: "Amazon RDS"
});


var indexRouter = require('./routes/index');
var postsRouter = require('./routes/posts');
var uploadsRouter = require('./routes/uploads');

var app = express();
var s3 = new aws.S3({ params: { Bucket: process.env.S3_BUCKET_NAME } });



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', indexRouter);
app.use('/uploads', uploadsRouter);


var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        acl: 'public-read',
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            cb(null, Date.now().toString())
        }
    })
})

let generateNames = function (count) {
    let names = [];
    while (names.length < count) {
        let name = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + NOUNS[Math.floor(Math.random() * NOUNS.length)];
        if (names.indexOf(name) < 0)
            names.push(name);
    }
    return names;
}

app.post('/upload', upload.single('photo'), function (req, res, next) {
    try {
        if (!req.file || !req.file.location) throw new Error('There was a problem with the file upload')
        let names = []

        names = generateNames(100);
        connection.query('SELECT name FROM posts WHERE name = ? GROUP BY name', names, function (error, results, fields) {
            if (error) {
                res.json({ success: false, error: error });
                return;
            }
            console.log(results);
            results.forEach(el => {
                if (names.indexOf(el.name) >= 0) names.splice(names.indexOf(el.name), 0)
            });

            if (names.length == 0) {
                res.json({ success: false, error: 'Could not generate a name. Please try again.' });
                return;
            }

            connection.query('INSERT INTO posts SET ?', { name: names[0], imageLocation: req.file.location }, function (error, results, fields) {
                if (error) res.json({ success: false, error: error });
                else res.json({ success: true, image: req.file.location, name: names[0], path: 'https://makeusefulstuff.herokuapp.com/posts/' + names[0] });
            });
        })
    } catch (err) {
        res.json({ success: false, error: err });
    }
})

app.get('/generateName/', function (req, res, next) {
    let name = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] + NOUNS[Math.floor(Math.random() * NOUNS.length)];
    res.json({ name });
});

app.get('/posts/:postId', function (req, res, next) {
    try {
        connection.query('SELECT * FROM posts WHERE name = ?', req.params.postId, function (error, results, fields) {
            try {
                if (error) throw error;
                if (results.length == 0) throw new Error();
                res.render('post', { name: results[0].name, image: results[0].imageLocation });
            } catch (err) {
                next(createError(404));
            }
        })
    } catch (err) {
        next(createError(404));
    }

});


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;