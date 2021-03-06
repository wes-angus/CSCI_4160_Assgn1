/* global __dirname */

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var userList = require('./Users.json');
var session = require('express-session');

var routes = require('./routes/index');
var users = require('./routes/users');
var fs = require('fs-extra');
var formidable = require('formidable');
var mkdirp = require('mkdirp');
//Requires GraphicsMagick to be installed on system to work properly
var gm = require('gm');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json())
   .use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'CSCI 4160',
    resave: false,
    saveUninitialized: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

//Upload images to the server
app.post('/upload', restrict, function(req, res) {
    var form = new formidable.IncomingForm();
    var path = 'public/images/' + req.session.user + '/';
    form.parse(req, function(err, fields, files) {
        console.log('upload received!');
    });
    
    var errored = false;

    form.on('fileBegin', function(name, file) {
        // Type of the file
        var type = file.type;

        //Restrict non-image files from being uploaded
        if(type != 'image/jpeg' && type != 'image/png' && type != 'image/gif')
        {
            //Treats the uploading of a non-image file as an error
            this.emit('error');
        }
    });
    
    //Stop the upload process and output
    //an error message when an error is encountered
    form.on('error', function (err) {
        errored = true;
        res.status(413).send('<p>Incorrect file type (or no file) chosen.</p>' +
                '<p>Only images (i.e. jpg or png) are accepted.</p>' +
                '<p>Hit "Back" to go back to the restricted page:</p>' +
                '<p><form action="/restricted">' +
                '<input type="submit" value="Back">' +
                '</form></p>');
    });

    form.on('end', function(fields, files) {
        /* Temporary location of our uploaded file */
        var temp_path = this.openedFiles[0].path;
        /* The file name of the uploaded file */
        var file_name = this.openedFiles[0].name;
        
        if(!errored)
        {
            // Location where the thumbnail will be stored
            var thumb_path = 'public/thumbs/' + req.session.user + '/';
            
            fs.copy(temp_path, path + file_name, function(err) {  
                if (err) {
                    console.error(err);
                } else {
                    //Create the directory if it does not exist
                    mkdirp(thumb_path, function(err) {
                        if(err) {
                            console.log(err);
                        } else {
                            //Save the thumbnail of the uploaded image (50x50)
                            gm(path + file_name).thumb(50, 50,
                            thumb_path + file_name, 50, function (err) {
                                if (!err) {
                                    console.log('thumb creation succeeded!');
                                } else {
                                    console.log(err);
                                }
                            });
                        }
                    });
                }
            });
            
            //Confirmation output
            res.writeHead(200);
            res.write('<p>Upload completed successfully!</p>');
            res.end('<p>Hit "Back" to go back to /restricted:</p>' +
                    '<p><form action="/restricted">' +
                    '<input type="submit" value="Back">' +
                    '</form></p>');
        }
    });    
});

//Main page after login
app.use('/restricted', restrict, function(req, res){
    res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>' + 
            '<p><form action="/uploader">' +
            '<input type="submit" value="Upload image">' +
            '</form></p>' + 
            '<p><form action="/summary">' +
            '<input type="submit" value="View list of images">' +
            '</form></p>');
});

// Show thumbnails of all images uploaded
app.get('/summary', restrict, function (req, res){
    var dirPath = 'thumbs/' + req.session.user + '/';
    //Attempt to read thumbnail directory
    //If non-existent,
    //output error message explaining no images have been uploaded
    fs.readdir('public/' + dirPath, function(err, files) {
        if(!err)
        {
            var title = 'Uploaded Images Summary';
            var images_HTML = '<head><title>' + title + '</title>' +
                    '<link rel="stylesheet" href="/stylesheets/style.css" />' +
                    '</head><body><h1>' + title + '</h1><p>';
            for(var i=0; i<files.length; i++)
            {
                //Display button that uses thumbnail of larger image it links to
                images_HTML += '<div><p><form action="/imageDisplay/' + files[i]
                        + '" method="get"> ' +
                        '<input type="image" src="' + dirPath + files[i] +
                        '" value="Submit"></form></p></div>';
            }
            res.send(images_HTML + '</p><div style="clear:both">' +
                    '<form action="/restricted">' +
                    '<input type="submit" value="Back">' +
                    '</form></div></body>');
        }
        else
        {
            console.log(err);
            //Output message when no images are found
            res.send('<p>Nothing to see here!</p>' +
                    '<p>Upload some images to view a list of all your ' +
                    'uploaded images here!</p>' +
                    '<p><form action="/restricted">' +
                    '<input type="submit" value="Back">' +
                    '</form></p>');
        }
    });
});

// Show selected image
app.get('/imageDisplay/:image', restrict, function (req, res){
    file = req.params.image;
    var img_path = '/images/' + req.session.user + '/' + file;
    res.send('<img src="' + img_path + '" alt="Your uploaded image">' +
            '<p><form method="post" action="/download/' + file + '">' +
            '<input type="submit" value="Download image">' +
            '</form><form action="/summary">' +
            '<input type="submit" value="Back">' +
            '</form></p>');
});

//Save new user to a file
app.post('/register', function(req, res) {
    if(!userList[req.body.username])
    {
        userList[req.body.username] = req.body.password;
        fs.writeFile('./Users.json', JSON.stringify(userList),
        function(err) {
            if(err) {
                return console.log(err);
            }
            else
            {
                console.log("The user was saved!");
            }
        });
        res.redirect('login');
    }
});

app.use('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

//GET register page
app.get('/register', function(req, res){
  res.render('register');
});

//GET file upload page
app.get('/uploader', restrict, function(req, res){
  res.render('uploader');
});

function authenticate(name, pass, fn) {
  var user = userList[name];
  // query the db for the given username
  if (!user) return fn(new Error('cannot find user'));
  // check for the correct password
  if(userList[name] == pass)
	return fn(null,user);
  else
	return fn(new Error("Invalid Password"));
}

/* GET home page. */
app.get('/login', function(req, res, next) {
  res.render('login');
});

//Download image given as parameter
app.post('/download/:filename', restrict, function(req, res){
  var filename = req.params.filename;
  var file = 'public/images/' + req.session.user + '/' + filename;
  res.download(file, function(err){
    if (err) {
      console.log(err);
    } else {
      console.log('file downloaded!');
    }
  });
});

app.post('/login', function(req, res, next) {
    authenticate(req.body.username, req.body.password, function(err, user){
        if (user) {
            // Regenerate session when signing in
            // to prevent fixation 
            req.session.regenerate(function(){
                // Store the user's primary key 
                // in the session store to be retrieved,
                // or in this case the entire user object
                req.session.user = req.body.username;
                req.session.success = 'Authenticated as ' + user.name +
                  ' click to <a href="/logout">logout</a>. ' +
                  ' You may now access <a href="/restricted">/restricted</a>.';
                res.redirect('restricted');
            });
        } else {
            req.session.error = 'Authentication failed, please check your '
              + ' username and password.'
              + ' (use "mark" and "password")';
            res.redirect('login');
        }
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
