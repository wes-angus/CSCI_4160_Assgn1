var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var userList = require('Users.json');
var session = require('express-session');

var routes = require('./routes/index');
var users = require('./routes/users');
var fs = require('fs');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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

app.use('/restricted', restrict, function(req, res){
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

//Save new user to a file
app.post('/register', function(req, res, next) {
    userList[req.body.username] = req.body.password;
    fs.writeFile('./node_modules/Users.json', JSON.stringify(userList), function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("The user was saved!");
    });
    res.redirect('login');
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

app.post('/login', function(req, res, next) {
authenticate(req.body.username, req.body.password, function(err, user){
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation 
      req.session.regenerate(function(){
        // Store the user's primary key 
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "mark" and "password")';
      res.redirect('login');
    }}
)});

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
