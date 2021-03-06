//mongoose includes
var mongoose = require("mongoose")
var uri =   process.env.MONGODB_URI || 
  process.env.MONGOLAB_URI || 
    'mongodb://localhost/HelloMongoose';
db = mongoose.connect(uri,  function (err, res) {
    if (err) { 
      console.log ('ERROR connecting to: ' + uri + '. ' + err);
    } else {
      console.log ('Succeeded connected to: ' + uri);
    }
});
Schema = mongoose.Schema;

//Express stuff
var express = require('express');
var server = express();
server.use(express.bodyParser());

//GCM stuff
var gcm = require('node-gcm');

//TWIT stuff
var Twit = require('twit');
var T = new Twit({
  consumer_key: '8MKPgNNynlgsvZicbDAYzw',
  consumer_secret: 'OOwwE430SSiOHn8UjWn7QOMdRfiuut72jPvf0J6Gw',
  access_token: '1113034020-yMIZFV7MZuyZaYRTzE5uD5vf7PsMuv2uYegws1h',
  access_token_secret: 'GvaLOpiOLJvuN3PVDFTQFZtPP7HqGwxDzKHj6HPX8M'
});

//DATABASE INIT
var ObjectId = mongoose.Schema.Types.ObjectId;
var TweetSchema = new Schema({
  tweeter: String,
  time: { type: Date, default: Date.now },
  content: String,
},{capped: 104857600});
var TrendSchema = new Schema({
  trend_name: String,
  trend_query: String,
  users: {type: ObjectId, ref: 'User'},
  tweets: [TweetSchema],
  newcounter: {type: Number, default:0}
});
var UserSchema = new Schema({
  registration_id: String,
  trend: [TrendSchema],
  is_watching: { type: Boolean, default: false}
});

User = mongoose.model('User', UserSchema);
Trend = mongoose.model('Trend', TrendSchema);
Tweet = mongoose.model('Tweet', TweetSchema);


//////
//Initialize a user
////
function initializeUser(req, res, next){
  if(!req.body.regId)
    res.send("invalid regID");
  var user = new User();
  user.registration_id = req.body.regId;
  user.save(function(){
    pingUser(user.registration_id, "_id", user._id);
    res.send(user);
  });
}

//////
//Get the current top 5 trending topics NOTE SHOULD BE MADE INTO SELF EXECUTING NAMED ANONYMOUS EVENTUALLY
////
function setCurrentTrends(){
  T.get('trends/place', {'id':'1'}, function(err, reply){
    if(err){
      console.log(err);
      return;
    }
    var trends = [];
    Trend.find({}, function(arr,data){
      trends = data;
    //FOR NOW CHOOSE 5
    var length = 5;
    var replyobject = reply[0].trends;
    while(length--){
      var currenttrend = trends[length];
      var secondlength = 5;
      var keep_trend = false;
      while(secondlength--){
        if (currenttrend && currenttrend.trend_name == replyobject[secondlength].name) keep_trend = true;
      }
      if(currenttrend && !keep_trend) Trend.remove({trend_name: currenttrend.trend_name});
    }
    
    //now that the DB is clean
    length = 5;
    while(length--){
      var size = 5;
      var is_in_db = false
      while(size--){
        if(trends.length && trends[size].trend_name == replyobject[length].name) is_in_db = true;
      }
      if(!is_in_db){
         var newtrend = new Trend();
         newtrend.trend_name = replyobject[length].name;
         newtrend.trend_query = replyobject[length].query;
         console.log(newtrend);
         newtrend.save();
      }
    }

      var stream = T.stream('statuses/filter', { track: trends[0].trend_name + ',' + trends[1].trend_name + ',' + + trends[2].trend_name + ',' + trends[3].trend_name + ',' + trends[4].trend_name });
      stream.on('tweet', function(tweet){addTweet(tweet)});
      console.log("Successfully updated the trends");
    });
  });
}
//FIGURE OUT HOW TO TELL WHICH TREND THE TWEET BELONGS TO
function addTweet(tweet, trend ){
  if (tweet.text.indexOf("RT") == 1 || tweet.text.indexOf("RT") == 0) return;
  var newtweet = new Tweet();
  newtweet.tweeter = tweet.user.name;
  newtweet.time = tweet.created_at;
  newtweet.content = tweet.text;
  newtweet.save(function(err){
   if(err) {
     console.log("fuck: " + err);
     return;
   }
   console.log("saved a tweet by " + newtweet.tweeter); 
  });
  //SAVE TO TREND HERE
}
function testCurrentTrends(req, res, next){
  var reply = setCurrentTrends();
}

function getCurrentTrends(req, res, next){
  Trend.find().execFind(function(arr,data){
    res.send(data);
  });
}
//////
//Set the currently trending topic
////
function setTrendingForUser(req, res, next){

}

//////
//flip the user's is_watching
////
function flipStatus(req, res, next){
  User.findById(req.body._id, function(err, user){
    user.is_watching = (!user.is_watching);
  });
}

//////
//Post the tweets to a user
////
function pingUser(ids, message_key, message_data){
  var message = new gcm.Message();
  message.addData(message_key,message_data);
  var sender = new gcm.Sender('AIzaSyDx1b8eGfFYEmAgrwp7qgTwU3SSU9_1mu4');
  var array = [];
  array.push(ids);
  sender.send(message, array, 5, function(err, result){
    if(err) console.log(err);
  });
}

function testPing(req, res, next){
  User.findOne(function (err, doc){
    pingUser(doc.registration_id, "update", "update");
    res.send('sent that bitch');
  });
}

var the_interval = 60 * 60 *1000;
setInterval(setCurrentTrends(), the_interval);

server.post('/newuser', initializeUser);
server.get('/testping', testPing);
server.get('/testtrends', testCurrentTrends);
server.get('/currenttrends', getCurrentTrends);
server.post('/settrend', setTrendingForUser);

var port = process.env.PORT || 8080;
server.listen(port, function(){
  console.log('listening at %s', port);
});
