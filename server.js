require('dotenv').config();
const express             = require('express');
const app                 = express();
const server              = require('http').Server(app);
const io                  = require('socket.io')(server);
const { v4: uuidV4 }      = require('uuid');  //for generating random Room IDs
const bodyParser          = require('body-parser');
const expressSanitizer    = require('express-sanitizer');
const mongoose            = require('mongoose');
const passport            = require('passport');
const LocalStrategy       = require('passport-local');
const session             = require('express-session');
const flash               = require('connect-flash');
const methodOverride      = require('method-override');  //for executing PUT requests
const User                = require('./models/user');
const post                = require('./models/post');
const MongoStore          = require('connect-mongo');
const {isLoggedIn}        = require('./middleWare');
const postRoutes          = require('./routes/postRoutes');
const userRoutes          = require('./routes/userRoutes');
const roomRoutes          = require('./routes/roomRoutes');
const port                = process.env.PORT || 3000;
// const db_URL              = 'mongodb://localhost:27017/msUserDb';
const db_URL              = process.env.DB_URL;
require('./googleAuthenticate');

let flag=false;
let username="";

app.use(express.static('public'));

mongoose.connect(db_URL,{useNewUrlParser: true, useUnifiedTopology: true})
    .then(() =>{
      console.log("Mongo ready to rock")
    })
    .catch(err => console.error);
    
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, {
  debug: true
});


app.use(session ({
  store: MongoStore.create({ mongoUrl: db_URL }),
  secret: 'notagoodsecret',
  resave:false,
	saveUninitialized:false,
}));

app.use(methodOverride("_method"));
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSanitizer())
app.set('view engine', 'ejs');
app.use('/peerjs', peerServer);

app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
  res.locals.flag=flag;
  res.locals.currentUser="";
	if(req.isAuthenticated()){ res.locals.currentUser = req.user; username=req.user.name;}
	res.locals.error=req.flash("error");
	res.locals.success=req.flash("success");
	next();
})

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// Routes 

// Home Page Route
app.get('/', (req, res) => {
  if(req.isAuthenticated()){
    res.redirect('/explore');
    return;
  }
  res.render('home')
})

app.get('/explore', isLoggedIn , (req, res) => {
  flag=false;
  res.render('explore')
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['email' , 'profile'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
});

app.use(userRoutes);
app.use(postRoutes);
app.use(roomRoutes);

 

io.on('connection', socket => {

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    let user = {userId: userId , username: username}
    socket.broadcast.to(roomId).emit('user-connected', user);

    socket.on('message', (message) => {
      io.to(roomId).emit('createMessage', message)
  }); 

    // socket.on('joined',(username) => {
    //   io.to(roomId).emit('addParticipant',username);
    // })

    socket.on('know-my-id', (herObj)=>{
      socket.broadcast.to(roomId).emit('know-my-id', herObj);
    })

    socket.on('disconnect', () => {
      socket.broadcast.to(roomId).emit('user-disconnected', userId)
    })
  })
}) 

server.listen(port);