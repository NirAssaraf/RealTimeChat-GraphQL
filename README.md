# RealTimeChat-GraphQL

how to start?
on terminal run the commends:

1. npm install
2. npm run dev
3. server will run on port 3000 => http://localhost:3000/

GrapQL playground quarys:

//**************************************************  Querys ********************************************************************//

//messages for specific room
{
  messages(room:"test3"){
    content
    userName
    room
  }
}



//gel all rooms info (only messages id's)
{
  rooms{
    name
    messages
    users    
  }
}


//get all info about specific room

{
  room(room:"test3"){
    name
    messages{
      content
      userName
      room
    }
    users{
      name
    }
  }
}

//get all users
{
  users{
    name
    password
    email
  }
}


//get user by email

{
  user(email:"assarafnir@gmail.com"){
    name
    password
    email
  }
}

//**************************************************  Mutations ********************************************************************//

//add new message to room

mutation addMessage($room:String!,$content:String!,$userName:String!){
  addMessage(room:$room,content:$content,userName:$userName){
    content
    room
    userName
  }
}


//add new User

mutation addUser($name:String!,$email:String!,$password:Int!){
  addUser(name:$name,email:$email,password:$password){
			name
    email
    password
  }
}

//disconnect from the room

mutation disconnectRoom($email: String!$room: String!){
  disconnectRoom(email:$email,room:$room)
}


//**************************************************  Subscription ********************************************************************//

//connect the room- get evrey message that sent to the room + get info about how id connect/disconnect to the room

subscription connectToRoom($email: String!$room: String!){
  connectToRoom(email:$email,room:$room)
}


//get live data when client connect the room / disconnect the room

subscription manageRooms{
  manageRooms{
    name
    users
  }
}









