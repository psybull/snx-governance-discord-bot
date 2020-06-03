import * as Discord from 'discord.js';
import { Config, CreateData, FLAGS} from './config';
import {Poll, PollStatus} from './Poll'


let client:Discord.Client = new Discord.Client();

let guildStore:Map<string,GuildDataStore>;

export interface GuildDataStore {
  channels:Map<string,Discord.GuildChannel>;
  roles:Map<string,Discord.Role>;
  polls:{
    creating:Array<Poll>;
    running:Array<Poll>;
    ended:Array<Poll>;
  }
  runningPollChannelIds: Array<string>;
}


async function initializeRoles(guild:Discord.Guild){
  const roleStore = guildStore.get(guild.id).roles;

  for(let [name,data] of Config.Roles){
    roleStore.set(name,null);
  }

  //retrieve values from Manager cache, if found
  guild.roles.cache.forEach((guildRole:Discord.Role)=>{
    if(roleStore.has(guildRole.name)){
      //console.log('found existing: '+guildObj.name)
      roleStore.set(guildRole.name,guildRole);
    }
  })
  for (let [name,data] of Config.Roles){
    if(roleStore.get(name) === null){
      let newRole = await guild.roles.create(data)
      roleStore.set(name,newRole);
    }
  }
}

async function initializeChannels(guild:Discord.Guild){
  const channelStore = guildStore.get(guild.id).channels;

  for(let [name,data] of Config.Channels){
    channelStore.set(name,null);
  }

  //retrieve values from Manager cache, if found
  guild.channels.cache.forEach((guildChannel:Discord.GuildChannel)=>{
    if(channelStore.has(guildChannel.name)){
      //console.log('found existing: '+guildObj.name)
      channelStore.set(guildChannel.name,guildChannel);
    }
  })
  for (let [name,data] of Config.Channels){
    if(channelStore.get(name) === null){
      let newChannelData = {
        ...data,
        parent:channelStore.get('parent'),
        permissionOverwrites:[{id:guild.id,allow:0,deny:FLAGS.ALL_TEXT}]
      } as Discord.GuildCreateChannelOptions;

      let newChannel = await guild.channels.create(name,newChannelData);
      channelStore.set(name,newChannel);
    }
  }
}

async function updateChannelPermissions(guild:Discord.Guild){
  for (let [name,channel] of guildStore.get(guild.id).channels){
    switch(name){
      case 'poll-results':
      case 'poll-management':
        await channel.overwritePermissions(Config.Channels.get(name).getPermissionOverwrites(guild,guildStore.get(guild.id).roles));
        break;
      case 'Apella':
        //nothing for now
        break;
    }
  }
}

//update add voting privileges to members matching the specified requirements, currently coded to 1 week old
async function updateVoterRoles(guild:Discord.Guild){
  const maximumAgeTimestamp = new Date().getTime() - Config.voterAccountAge
  guild.members.cache.filter((member:Discord.GuildMember)=>{
    const voterRole = member.roles.cache.filter((role)=>{return role.name === 'Spartiates'});
    return (voterRole.size === 0 && member.joinedTimestamp < maximumAgeTimestamp);
  }).forEach(async (newVoteMember)=>{
    //console.log('adding voter role for ' + newVoteMember.displayName);
    await newVoteMember.roles.add(guildStore.get(guild.id).roles.get('Spartiates'));
  })
  return;
}

async function initializeGuild(guild:Discord.Guild){
  let store = {
    channels:new Map<string,Discord.GuildChannel>(),
    roles:new Map<string,Discord.Role>(),
    polls:{
      creating:new Array<Poll>(),
      running:new Array<Poll>(),
      ended:new Array<Poll>()
    },
    runningPollChannelIds:new Array<string>()
  }

  guildStore.set(guild.id,store);
  console.log(guild.emojis)

  
  await initializeRoles(guild);

  //initialize parent category for poll channel organization - TODO: support multiple Categories
  let foundCategory = [...guild.channels.cache.values()].find(({name}) => name === 'Apella')
  if(!foundCategory){
    foundCategory = await guild.channels.create('Apella',Config.Categories.get('Apella') as Discord.GuildCreateChannelOptions)
  }
  store.channels.set('parent',foundCategory);

  //initialize default polling channels
  await initializeChannels(guild);

  //await updateVoterRoles(guild);

  await updateChannelPermissions(guild);
}

export async function init(suppliedClient:Discord.Client){
  //initialize empty store
  guildStore = new Map<string,GuildDataStore>();

  //save client
  client = suppliedClient;

  //process setup for every guild
  client.guilds.cache.forEach(initializeGuild);
}


export function processCommand(suppliedMessage:Discord.Message){
  //command messages will only come in from either the management channel, or one of the running Polls channels
  const store = guildStore.get(suppliedMessage.guild.id)
  if(suppliedMessage.channel.id === store.channels.get('poll-management').id){
    processManagementCommands(suppliedMessage);
  }else if(store.runningPollChannelIds.indexOf(suppliedMessage.channel.id) >= 0){
    processVoteCommands(suppliedMessage)
  }
}

async function processManagementCommands(suppliedMessage:Discord.Message){
  let commandSplit = suppliedMessage.content.substr(1).split(' ')
  const command = commandSplit.shift();
  const guildData = guildStore.get(suppliedMessage.guild.id)

  if(command === 'help'){
    let manageHelp = "Here's a crash course on a normal poll lifecycle:\n\n" ;
    manageHelp += "1. `!create` - create a blank new poll\n" ;
    manageHelp += "2. Edit the poll data:\n";
    manageHelp += "\t* `!title Example Poll` - change the title to given title\n";
    manageHelp += "\t* `!body Do you like this example poll?` - change the body to the given text (supports Discord markdown)\n";
    manageHelp += "\t* `!option :thumbsup: Yes, I love it!` - add a vote option, :thumbsup:, with the option description as given text (also supports Discord markdown)\n";
    manageHelp += "\t* `!option :thumbsdown: No, it stinks!` - add another vote option, similar to above\n"
    manageHelp += "3. `!start` - publish poll and open for voting\n"
    manageHelp += "4. `!end` - end running poll\n\n"

    manageHelp += "`!delete *poll_id*` - remove poll (id required always)\n"
    manageHelp += "`!resetall` - clear all Poll memory and re-initialize the bot - only use as last resort (you must delete any temporary voting channels manually)\n\n"

    manageHelp += "The bot will always assume the command is targeting the *oldest created* poll.  If multiple polls are created/running, specify the poll id in the command (e.g. `!Title a6e04e Changing the title for poll a6e04e!!`)\n\n";

    suppliedMessage.author.send(manageHelp)
  }else if(command === 'resetall'){
    suppliedMessage.reply('OK - Deleting memory, and re-initializing');
    initializeGuild(suppliedMessage.guild)
  }else if(command === 'delete'){

    const allPolls = [...guildData.polls.creating,...guildData.polls.running,...guildData.polls.ended]

    let idLookup = allPolls.find((poll)=>{return poll.id===commandSplit[0]})
    if(idLookup){
      suppliedMessage.reply('Deleting Poll - '+idLookup.id);
      idLookup.delete();

      switch(idLookup.status){
        case PollStatus.create:
          guildData.polls.creating.splice(guildData.polls.creating.indexOf(idLookup),1);
          break;
        case PollStatus.run:
          guildData.polls.running.splice(guildData.polls.running.indexOf(idLookup),1);
          break;
        case PollStatus.end:
          guildData.polls.ended.splice(guildData.polls.ended.indexOf(idLookup),1);
          break;
      }
    }else{
      suppliedMessage.reply({content:'Deleting a poll requires valid poll `ID`',timeout:10000});

    }
  }else if(command === 'create'){
    const newPoll = new Poll(client,suppliedMessage.guild.id,guildData)
    guildData.polls.creating.push(newPoll);
  }else if (command === 'end'){
    let targetPoll = guildData.polls.running[0];
    let idLookup = guildData.polls.running.find((poll)=>{return poll.id===commandSplit[0]})
    if(idLookup){
      targetPoll = idLookup;
      commandSplit.shift();
    }
    await targetPoll.end();
    guildData.polls.running.splice(guildData.polls.running.indexOf(targetPoll),1);
    guildData.polls.ended.push(targetPoll);
    guildData.runningPollChannelIds.splice(guildData.runningPollChannelIds.indexOf(targetPoll.votingChannel.id),1)
  }else{
    if(guildData.polls.creating.length === 0){
      suppliedMessage.reply('There are no polls being created, try `!create` or `!help`');
    }else{
      let targetPoll = guildData.polls.creating[0];
      let idLookup = guildData.polls.creating.find((poll)=>{return poll.id===commandSplit[0]})
      if(idLookup){
        targetPoll = idLookup;
        commandSplit.shift();
      }

      switch(command){
        case 'title':
          targetPoll.update({title:commandSplit.join(" ")})
          break;
        case 'body':
          targetPoll.update({body:commandSplit.join(" ")});
          break;
        case 'option':
          const option = commandSplit.shift()
          targetPoll.updateOption(option,commandSplit.join(" "));
          break;
        case 'start':
          await targetPoll.start();
          guildData.polls.creating.splice(guildData.polls.creating.indexOf(targetPoll),1);
          guildData.polls.running.push(targetPoll);
          guildData.runningPollChannelIds.push(targetPoll.votingChannel.id)
          break;
      }
    }
  }
}

function processVoteCommands(suppliedMessage:Discord.Message){
  const commandSplit = suppliedMessage.content.substr(1).split(' ')
  const voteCommand = suppliedMessage.content.substr(1).split(' ')[0];
  const guildData = guildStore.get(suppliedMessage.guild.id)

  const targetPoll = guildData.polls.running.find((poll)=>{return poll.votingChannel.id===suppliedMessage.channel.id})
  console.log('targetPoll')
  console.log(targetPoll)
  switch(voteCommand){
    case 'vote':
      targetPoll.vote(suppliedMessage);
      break;
    case 'withdraw':
      targetPoll.withdraw(suppliedMessage);
      break;
  }

  
}