# Switchboard 2 Install Guide
http://switchboard2.com:8080/

Setting up Switchboard 2 is quick and easy if you're already familiar with Node.js. I recommend using NPM to install required modules.

# Requirements
* Web Server
* Node.js
* [Twilio Account](https://www.twilio.com/try-twilio)

## Step 1: Install dependent modules
	npm install iniparser csv connect express jade socket.io twilio

## Step 2: Get the Code
Download the latest release and unpack the source code onto your server

## Step 3: Configure settings
Open config.ini and fill in the required settings.

## Step 4: Add phone numbers
Open operators.txt and add employee names and numbers to transfer to. Add each number on its own line.
Names and phone numbers should be separated with tabs.

	Chad Smith	13165555555

## Step 5: Add additional routing options
Open plugins.txt and add plugin names and TwiML (or Twimlet/OpenVBX URLs). Each plugin should be on its own line.
Plugin names and content should be separated using tabs.

	Hangup	<Hangup/>
	Conference	http://twimlets.com/conference
	
## Step 6: Run the Switchboard server
	node server.js

or

	forever start server.js

## Contribute
I released this source in hopes that people would help make the project better (especially when it comes to design)
so please contact me with your ideas and enhancements.
