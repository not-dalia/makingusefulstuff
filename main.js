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
var geoip = require('geoip-country');
const bodyParser = require('body-parser');
var Twit = require('twit')

const NOUNS = ["3DPrinter", "Maker", "Inventor", "Creator", "Scientist", "Engineer", "Designer", "Programmer", "Robot", "LaserCutter", "Knitter", "Chip", "Ink", "Electron", "Proton", "Artist", "Arduino", "Hacker", "Button", "Sensor", "PowerSupply", "Transistor", "Resistor", "Capacitor", "LED", "Coil", "Motor", "Actuator", "Ribbon", "Pin", "Scissors", "Filament", "Thimble", "Needle", "Hammer"];
const ADJECTIVES = ["Antimatter", "Crafty", "Terrific", "Ubiquitous", "Rebellious", "Efficacious", "Fastidious", "Jocular", "Playful", "Nefarious", "Zealous", "Ambiguous", "Auspicious", "Berserk", "Bustling", "Calculating", "Colossal", "Decisive", "Dynamic", "Elastic", "Ethereal", "Exuberant", "Fabulous", "Fearless", "Grandiose", "Harmonious", "Hypnotic", "Incandescent", "Invincible", "Nebulous", "Nimble", "Omniscient", "Quirky", "Stupendous", "Thundering", "Whimsical", "Malevolent", "Spooky", "Majestic", "Epic", "Humble"];



var connection = mysql.createConnection({
    host: process.env.AWS_DB_HOST,
    user: process.env.AWS_DB_USER,
    password: process.env.AWS_DB_PASS,
    database: process.env.AWS_DB_NAME,
    ssl: "Amazon RDS",
    charset: 'utf8mb4'
});

var T = new Twit({
    consumer_key: process.env.TW_CONSUMER_KEY,
    consumer_secret: process.env.TW_CONSUMER_SECRET,
    access_token: process.env.TW_ACCESS_TOKEN,
    access_token_secret: process.env.TW_ACCESS_TOKEN_SECRET,
    timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests. 
})



var indexRouter = require('./routes/index');
var postsRouter = require('./routes/posts');
var uploadsRouter = require('./routes/uploads');

var app = express();
var s3 = new aws.S3({ params: { Bucket: process.env.S3_BUCKET_NAME } });



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.locals.moment = require('moment');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


//app.use('/', indexRouter);
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

let getRequestIp = function (req) {
    var ip;
    if (req.headers['x-forwarded-for']) {
        ip = req.headers['x-forwarded-for'].split(",")[0];
    } else if (req.connection && req.connection.remoteAddress) {
        ip = req.connection.remoteAddress;
    } else {
        ip = req.ip;
    }
    ip = (ip.length < 15 ? ip : (ip.substr(0, 7) === '::ffff:' ? ip.substr(7) : undefined));


    console.log('ip address', ip);
    return ip;
}


app.get('/', function (req, res, next) {
    try {
        connection.query('SELECT * FROM posts_with_comments ORDER BY creationDate DESC', function (error, results, fields) {
            try {
                if (error) throw error;
                res.render('index', { title: 'Make Useful Things', posts: results });
            } catch (err) {
                next(createError(404));
            }
        })
    } catch (err) {
        next(createError(404));
    }
});

app.get('/:postName', function (req, res, next) {
    try {
        connection.query('SELECT * FROM posts_with_comments WHERE name = ?', req.params.postName, function (error, results, fields) {
            try {
                if (error) throw error;
                if (results.length == 0) throw new Error();
                let spacedName = results[0].name;
                var nth = 0;
                spacedName = spacedName.replace(/([A-Z])/g, function (match, i, original) {
                    nth++;
                    return (nth === 2) ? ' ' + match : match;
                }).trim() ;
                res.render('post', { name: results[0].name, image: results[0].imageLocation, postId: results[0].post_id, content: results[0].content, commentCount: results[0].comment_count, title: 'Make Useful Stuff - ' + spacedName, spacedName: spacedName, date: results[0].creationDate});
            } catch (err) {
                next(createError(404));
            }
        })
    } catch (err) {
        next(createError(404));
    }

});

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
                else {
                    T.post('statuses/update', { status: 'Check out ' + names[0] + '\'s new button! #makeusefulstuff #makerfaireUK \n' + 'http://www.makeusefulstuff.eu/posts/' + names[0] }, function (err, data, response) {
                        console.log(data)
                    })

                    res.json({ success: true, image: req.file.location, name: names[0], path: 'http://www.makeusefulstuff.eu/posts/' + names[0] });
                }
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

app.get('//:postname', function (req, res, next) {
    res.redirect('/' + req.params.postname);
})

app.get('//posts/:postname', function (req, res, next) {
    res.redirect('/posts/' + req.params.postname);
})

app.get('/posts/:postName', function (req, res, next) {
    try {
        connection.query('SELECT * FROM posts_with_comments WHERE name = ?', req.params.postName, function (error, results, fields) {
            try {
                if (error) throw error;
                if (results.length == 0) throw new Error();
                let spacedName = results[0].name;
                var nth = 0;
                spacedName = spacedName.replace(/([A-Z])/g, function (match, i, original) {
                    nth++;
                    return (nth === 2) ? ' ' + match : match;
                }).trim() ;
                res.render('post', { name: results[0].name, image: results[0].imageLocation, postId: results[0].post_id, content: results[0].content, commentCount: results[0].comment_count, title: 'Make Useful Stuff - ' + spacedName, spacedName: spacedName, date: results[0].creationDate});
            } catch (err) {
                next(createError(404));
            }
        })
    } catch (err) {
        next(createError(404));
    }

});

app.post('/comments/:postId', function (req, res, next) {
    try {
        if (!req.body.text || req.body.text.replace(/\s+$/g, '') == '' || !req.params.postId) throw new Error('Missing params');
        let ip = getRequestIp(req);
        var geo = geoip.lookup(ip);
        console.log(ip);
        connection.query('INSERT INTO comments SET ?', { post_id: req.params.postId, comment_text: req.body.text.replace(/\s+$/g, ''), country: (geo && geo.country) || 'Unknown' }, function (error, results, fields) {
            try {
                if (error) throw error;
                connection.query('SELECT * FROM comments WHERE post_id = ? ORDER BY comment_time DESC', req.params.postId, function (error, results, fields) {
                    if (error) { res.json({ success: false, error: err }); return; }
                    res.json({ success: true, comments: results });
                })
            } catch (err) {
                res.json({ success: false, error: err });
            }
        })
    } catch (err) {
        res.json({ success: false, error: err });
    }
})


app.get('/comments/:postId', function (req, res, next) {
    try {
        if (!req.params.postId) throw new Error('Missing params');
        connection.query('SELECT * FROM comments WHERE post_id = ? ORDER BY comment_time DESC', req.params.postId, function (error, results, fields) {
            if (error) { res.json({ success: false, error: err }); return; }
            res.json({ success: true, comments: results });
        })

    } catch (err) {
        res.json({ success: false, error: err });
    }
})


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