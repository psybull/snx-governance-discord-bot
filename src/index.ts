import * as Discord from 'discord.js';
//import * as server from './oauthListener'
import * as VoteManager from './VoteManager'



const client = new Discord.Client();

//not added to the repo, need a json file with a {prefix:string,token:string}
//the token needs to match the bot you wanna use
import {prefix,token} from '../config.json';

//server.init();


function checkData(){
	console.log('ok')
	console.log(client.guilds)
}


client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	VoteManager.init(client)
});

client.on('message', msg => {
	//console.log(msg)
	if (msg.content.indexOf(prefix) === 0) {
		VoteManager.processCommand(msg);
	}
});

client.login(token);