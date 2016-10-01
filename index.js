const express = require('express');
const app = express();
const path = require('path');
var mongoose = require('mongoose');
var flash = require('connect-flash');
// You need session to use connect flash
var session = require('express-session');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;

//setup
app.set('port', (process.env.PORT || 8000));
app.use('/lib', express.static(path.resolve(__dirname + '/lib')));
app.set('view engine', 'ejs');
app.use( session({
	saveUninitialized : true,
	secret : 'elSecreto' ,
	resave : true,
}));
app.use( passport.initialize());
app.use( passport.session());
app.use(flash());


//databse intialization
mongoose.connect("mongodb://heroku_wh98625c:hbuo8dj3vbdmpn34l9ij2spm9n@ds047666.mlab.com:47666/heroku_wh98625c");
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
	// we're connected!


	//defining professor schema
	var ProfSchema = new mongoose.Schema({
		username: String,
		UID: String,
		ClassID: [{type: String}]
	});

	//defining class Schema
	var ClassSchema = new mongoose.Schema({
		ClassName: String,
		LectureID: [{type: String}]
	});

	//defining Lecture Schema
	var LectureSchema = new mongoose.Schema({
		LectureName: String,
		Questions: [{
			QuestionText: String,
			QuestionID: String,
			Answer: String
		}]
	});

	var prof = mongoose.model('Professor', ProfSchema);
	// used to serialize the user for the session
	passport.serializeUser(function(user, done) {
		done(null, user.id); 
	});

	// used to deserialize the user
	passport.deserializeUser(function(id, done) {
		prof.findById(id, function(err, user) {
			done(err, user);
		});
	});

	//google authorization
	passport.use(new GoogleStrategy({
		clientID:
			"995418716168-n1va0lhckar2d3c2aouvh69cciif4mc9.apps.googleusercontent.com",
		clientSecret:  "GphMQPTqZIZT0_fdywHCS3-9",
		callbackURL: "https://sdhack16.herokuapp.com/auth/google/callback"
	},
	function(accessToken, refreshToken, profile, done) {
		prof.findOne({
			'UID': profile.id 
		}, function(err, user) {
			if (err) {
				return done(err);
			}
			//No user was found so create a new user with values from Google
			if (!user) {
				user = new prof({
					username: profile.displayName,
					UID: profile.id
				});
				user.save(function(err) {
					if (err) console.log(err);
					return done(err, user);
				});
			} else {
				//found user. Return
				return done(err, user);
			}
		})
	}
	));

	//signing into google
	app.get('/auth/google',
			passport.authenticate('google', { scope: ['profile'] }));

	//redirects based on login
	app.get('/auth/google/callback', 
			passport.authenticate('google', { 
				successRedirect: '/profile',
				failureRedirect: '/' 
			})
			);

	app.get('/profile', function(req, res){
		if(req.isAuthenticated()){
			
			prof.findOne({
				'_id': req.session.passport.user
			}, function(err, user){
				if(err) return err;
				username = user.username;
				res.render('pages/profile', {
					username : username
				});
			}
			);
		}
		else {
			res.render('pages/index');
		}
	});
	
	app.get('/class', function(req, res){
		if(req.isAuthenticated()){
			
			prof.findOne({
				'_id': req.session.passport.user
			}, function(err, user){
				if(err) return err;
				username = user.username;
				res.render('pages/class', {
					username : username
				});
			}
			);
		}
		else {
			res.render('pages/index');
		}
	});


	//getting port
	app.listen(app.get('port'), function() {
		console.log('Node app is running on port', app.get('port'));
	});

	//loading index
	app.get('/', function(req, res) {
		res.render('pages/index');
	});

});
