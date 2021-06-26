const { ApolloServer, gql ,PubSub} = require('apollo-server');
const admin = require('firebase-admin');

var serviceAccount = require("./permissions.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://keese-realtimechat..firebaseio.com"
});
const db = admin.firestore();

const expressGraphQL = require('express-graphql').graphqlHTTP
global.currentUsr
const subscribers = [];
const pubsub = new PubSub()
const ROOMS_CHANNEL ='ROOMS_CHANNEL'
const onMessagesUpdates = (fn) => subscribers.push(fn);
const typeDefs = gql`
type Query{
  messages(room:String):[Message]
  rooms:[Rooms]
  room(room:String):Room
  users:[User]
  user(email:String):User
}
type RoomsData{
  name:String,
  users:[String]
}
type Message{
  room: String,
  userName: String,
  content:  String,
  id:  String,
  time: String
}

type Rooms{
  name: String,
  messages:[String],
  users:[String]
}

type Room{
  name: String,
  messages:[Message],
  users:[User]
}

type User {
  name: String,
  email:String,
  password:Int
  isOnline:Boolean
}

type Mutation {
  addMessage(room: String!, content: String!, userName:String!): Message
  addUser(name: String!, email: String!, password:Int!): User
  EnterRoom(email:String!,room:String!):[Message]
  disconnectRoom(email:String!,room:String!) : String
}

type Subscription {
  messageSent: Message
  connectToRoom(room:String!,email:String!):String
  manageRooms:[RoomsData]
}
`;

const resolvers  ={
  Query: {
    messages: async (parent, args) =>{
      const messages=  await GetMessages(args)
      return messages
    },
    rooms: async () =>{
        const rooms = await getRooms()
        return rooms
      },
      room: async (parent, args) =>{
        const room = await getRoom(args.room)
        return room
     },
     users: async (parent, args) =>{
      const users = await getUsers(args)
      return users
    },
     user: async (parent, args) =>{
       const user = await getUser(args)
       return user
     },
  },
  Mutation: {
    addMessage: async (parent,args)=>{
     var chat= await addMsg(args)
      pubsub.publish('CHAT_CHANNEL', { messageSent: chat })
      pubsub.publish(args.room, { connectToRoom: `${args.userName} : ${chat.content}` })
      return chat
    },
    addUser: async (parent,args)=>{
      await addUser(args)
      return args
    },
    EnterRoom: async (parent,args)=>{
      var user = await EnterRoom(args)
      var messages = await GetMessages(args)
      return messages
    },
    disconnectRoom:async (parent,args)=>{
      var user= await disconnectRoom(args)
      return user
    }
  },
  Subscription: {
    messageSent: {
      subscribe (root, args, { pubsub }) {
        return pubsub.asyncIterator(CHAT_CHANNEL)
      }
    },
    connectToRoom : {
      subscribe: async (root, args, { pubsub })=> {
        var user= await EnterRoom(args)
        return pubsub.asyncIterator(args.room)
      }
    },
    manageRooms : {
      subscribe (root, args, { pubsub }) {
        return pubsub.asyncIterator(ROOMS_CHANNEL)
      }
    }
  }
}
const server2 = new ApolloServer({ typeDefs, resolvers, context: { pubsub } })

const PORT = process.env.PORT || 3000;

server2.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/*********************************** Async Functions ****************************************************/

async function  GetMessages(args){
  var AllMessages=[]
  var room= await db.collection("rooms").doc(args.room).get()
  var messagesIDdata= room.data()
  var messagesID= messagesIDdata.messages
  for( let msg of messagesID){
    var message= await db.collection("messages").doc(msg).get()
    AllMessages.push(message.data())
  }
  return AllMessages;
}

async function addMsg(args){
  var ID
  var msg =await db.collection("messages").add({
    room:args.room,
    userName:args.userName,
    content: args.content,
    // time: new Date(Date.now())
  }).then((doc)=>ID=doc.id)
  var message= await db.collection("messages").doc(ID).get()
  const FieldValue = admin.firestore.FieldValue;
  await db.collection("rooms").doc(args.room).update(
    "messages",FieldValue.arrayUnion(ID)
  )
  return message.data()
}

async function getRooms(){
  var AllRooms=[]
  var resData= db.collection('rooms');
    const snapshot = await resData.get();
    snapshot.forEach(doc => {
      AllRooms.push(doc.data());
});
  return AllRooms
}

async function getRoom(args){
  var AllMessages=[]
  var room= await db.collection("rooms").doc(args).get()
  var messagesIDdata= room.data()
  var messagesID= messagesIDdata.messages
  for( let msg of messagesID){
    var message= await db.collection("messages").doc(msg).get()
    AllMessages.push(message.data())
  }
  var roomData=room.data()
  var currentRoom= {
    name: roomData.name,
    messages: AllMessages,
    users:roomData.users
  }

  return currentRoom
}

async function getUsers(){
  var AllUsers=[]
  var resData= db.collection('users');
    const snapshot = await resData.get();
    snapshot.forEach(doc => {
      AllUsers.push(doc.data());
});
  return AllUsers
}

async function getUser(args){
  var user=[]
  var resData= db.collection('users').where('email','==',args.email);
  const snapshot = await resData.get();
  snapshot.forEach(doc => { 
    user.push(doc.data())
});
      return user[0]
}

async function addUser(args){
  var temp = await db.collection("users").where('email','==',args.email)
  var temp2=temp.get()
  .then(async (doc)=>{
    if(doc.empty){
     var user = await db.collection("users").add({
      name:args.name,
      email:args.email,
      password:args.password,
      isOnline:false
     })
     return user
    }else{
      return temp.data()
    }
  })
}

async function EnterRoom(args){
  var user=[]
  var userID
  var resData= db.collection('users').where('email','==',args.email)
  const snapshot = await resData.get();
  snapshot.forEach(doc => { 
    user.push(doc.data())
    userID=doc.id
  });
  if( user.length >0 ){
    var roomData= await getRooms()
    pubsub.publish(args.room, { connectToRoom: `${user[0].name} has enter the room` })
    var userChange= db.collection('users').doc(userID)
    userChange.update({
      "isOnline" : true
    })
    const FieldValue = admin.firestore.FieldValue;
    await db.collection("rooms").doc(args.room).update(
      "users",FieldValue.arrayUnion(user[0].name)
    ).then(
      pubsub.publish(ROOMS_CHANNEL, { manageRooms: roomData })
    )
     messages= GetMessages(args)
     return user[0]
  }else
      return 
}
async function disconnectRoom(args){
  var user=[]
  var userID
  var resData= db.collection('users').where('email','==',args.email)
  const snapshot = await resData.get();
  snapshot.forEach(doc => { 
    user.push(doc.data())
    userID=doc.id
  });
  if( user.length > 0 ){
    var userChange= db.collection('users').doc(userID)
    userChange.update({
      "isOnline" : false
    })
    user[0].isOnline=false
    var roomData
    const FieldValue = admin.firestore.FieldValue;
    await db.collection("rooms").doc(args.room).update({
      "users": FieldValue.arrayRemove(user[0].name)
     }).then(roomData= await getRooms()).then(      pubsub.publish(ROOMS_CHANNEL, { manageRooms: roomData })
     )

    return "GoodBye"
  }else
      return "GoodBye"
}
/**************************************************************************************/







