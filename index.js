const express = require('express');
const app = express();
const path = require('path');
var mongoose = require('mongoose');
var flash = require('connect-flash');
var bodyparser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth20').Strategy;
var Promise = require("bluebird");

//setup
app.set('port', (process.env.PORT || 8000));
app.use('/lib', express.static(path.resolve(__dirname + '/lib')));
app.set('view engine', 'ejs');
app.use( session({
	saveUninitialized : true,
	secret : 'elSecreto' ,
	resave : true,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(bodyparser());
Promise.promisifyAll(require("mongoose"));

var increment = 0;

//databse intialization
mongoose.connect("mongodb://heroku_wh98625c:hbuo8dj3vbdmpn34l9ij2spm9n@ds047666.mlab.com:47666/heroku_wh98625c");
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {

	//defining professor schema
	var ProfSchema = new mongoose.Schema({
		username: String,
		UID: String,
		ClassID: [{type: mongoose.Schema.Types.ObjectId}]
	});

	//defining class Schema
	var ClassSchema = new mongoose.Schema({
		ClassName: String,
		LectureID: [{type: mongoose.Schema.Types.ObjectId}],
		numLecture: String
	});
	
	//defining answer schema
	var AnswerSchema = new mongoose.Schema({
		PID: String,
		QuestionID: String,
		Answer: String
	});

	//defining Lecture Schema
	var LectureSchema = new mongoose.Schema({
		LectureName: String,
		numQuestions: String,
		QuestionText: [String],
		QuestionID: [String],
		Answer: [String],
		Responses: [AnswerSchema]
	});


	var prof = mongoose.model('Professor', ProfSchema);
	var course = mongoose.model('Class', ClassSchema);
	var lec = mongoose.model('Lecture', LectureSchema);
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

	//debug for localhost testing
	var cbURL;
	console.log(app.get('port'));
	if(app.get('port') == "8000"){
		cbURL = "http://localhost:8000/auth/google/callback";
	} else {
		cbURL = "https://sdhack16.herokuapp.com/auth/google/callback";

	}
	console.log(cbURL);

	//google authorization
	passport.use(new GoogleStrategy({
		clientID:
			"995418716168-n1va0lhckar2d3c2aouvh69cciif4mc9.apps.googleusercontent.com",
		clientSecret:  "GphMQPTqZIZT0_fdywHCS3-9",
		callbackURL: cbURL
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
				var classes = [];
				var classId = [];
				var allClasses = user.ClassID;
				for(var id = 0; id < allClasses.length; id++){

					course.findById(allClasses[id], function(err, found){
						if(err) return err;
						classes.push(found.ClassName);
						classId.push(found._id);
					});
				}
				setTimeout(function(){
					res.render('pages/class', {
						username : username,
						classes : classes,
						classid : classId
					});
				}, 2000);
			});
		}
		else {
			res.render('pages/index');
		}
	});

	//creating class for prof
	app.post('/createClass', function(req, res){
		if(req.isAuthenticated()){

			prof.findOne({
				'_id': req.session.passport.user
			}, function(err, user){
				if(err) return err;
				//creates new uniq class
				var newClass = new course({
					ClassName : req.body.className,
					numLecture : req.body.lectureNum,
				});
				console.log(newClass);
				var classes = [];
				var classId = [];
				//saves the new class to the database
				newClass.save(function (err, course) {
					if (err) return console.error(err);
					user.ClassID.push(course._id);
					user.save();
					classes.push(course.ClassName);
					classId.push(course._id);
				});


				username = user.username;
				var allClasses = user.ClassID;
				for(var id = 0; id < allClasses.length; id++){
					course.findById(allClasses[id], function(err, found){
						if(err) return err;
						classes.push(found.ClassName);
						classId.push(found._id);
					});
				}
				setTimeout(function(){
					res.render('pages/class', {
						username : username,
						classes : classes,
						classid : classId
					});
				}, 2000);
			});
		}
		else {
			res.render('pages/index');
		}
	});

	//loading lectures
	app.post('/lecture', function(req, res){
		if(req.isAuthenticated()){
			console.log(req.body);
			course.findOne({
				'_id': req.body.classID
			}, function (err, newCourse){
				if(err) console.log(err);
				
				var lectures = [];
				var questions = [];
				var questionNums = [];
				var lecIds = [];
				var allLectures = newCourse.LectureID;
				for(var id = 0; id < allLectures.length; id++){
					lec.findById(allLectures[id], function(err, found){
						if(err) return err;
						lectures.push(found.LectureName);
						questions.push(found.Questions);
						questionNums.push(Number(found.numQuestions));
						console.log(found.numQuestions);
						lecIds.push(found._id);
					});
				}	
				setTimeout(function(){
					console.log(questionNums);
					res.render('pages/lectures', {
						ClassName : newCourse.ClassName,
						lectures : lectures,
						Questions : questions,
						classID : req.body.classID,
						questionNums : questionNums,
						LecID : lecIds
					});
				}, 2000);
			});
		}
		else {
			res.render('pages/index');
		}
	});

	//creating new lecture
	app.post('/createLecture', function(req, res){
		if(req.isAuthenticated()){

			course.findOne({
				'_id': req.body.classID
			}, function(err, newCourse){
				if(err) return err;
				//creates new uniq class
				var newLec = new lec({
					LectureName : req.body.lecName,
					numQuestions : req.body.numQuestions,
				});
				
				var lectures = [];
				var questions = [];
				var questionNums = [];
				var allLectures = newCourse.LectureID;
				var Lecid = [];

				newLec.save(function (err, course) {
					if (err) return console.error(err);
					newCourse.LectureID.push(course._id);
					newCourse.save();
					lectures.push(course.LectureName);
					Lecid.push(course._id);
					questionNums.push(course.numQuestions);
				});
				
				for(var id = 0; id < allLectures.length; id++){
					lec.findById(allLectures[id], function(err, found){
						if(err) return err;
						console.log(found.LectureName);
						lectures.push(found.LectureName);
						questions.push(found.Questions);
						Lecid.push(found._id);
						questionNums.push(found.numQuestions);
					});
				}	
				setTimeout(function(){
					console.log(questionNums);
					res.render('pages/lectures', {
						ClassName : newCourse.ClassName,
						lectures : lectures,
						Questions : questions,
						classID : req.body.classID,
						questionNums : questionNums,
						LecID : Lecid
					});
				}, 2000);
			});
		}
		else {
			res.render('pages/index');
		}
	});
	
	//handling creating a new series of questions for lecture
	app.post('/createQuestions', function(req, res){
		if(req.isAuthenticated()){
			lec.findOne({
				'_id' : req.body.LecID
			}, function(err, lecture){
				
				//updating answer and question values
				lecture.QuestionText = req.body.Qtext;
				lecture.Answer = req.body.Qans;
				var IDlist = [];
				for(var i = 0; i < Number(lecture.numQuestions); i++){
					lecture.QuestionID.push((increment++).toString());	
				}
				setTimeout(function(){
					console.log(lecture);
					lecture.save();
					res.render('pages/index');
				}, 3000);
		
			});
		} else {
			res.render('pages/index');
		}
	});

	//handling iphone posts
	app.post('/iphone', function(req, res){
		console.log(req.body);
		console.log("something recieved");
		lec.find({'QuestionID' : req.body.QuestionID}, function(err, lecture){
			lecture.Responses.push({'PID' : req.body.PID, 
															'QuestionID' : req.body.QuestionID,
															'Answer' : req.body.Answer});
			lecture.save();
		});
		res.json(200);
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
