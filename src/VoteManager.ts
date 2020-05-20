import * as Discord from 'discord.js';
import * as _ from 'lodash';
import { Config, CreateData, FLAGS} from './config';
import { v4 as uuidv4 } from 'uuid';

let client:Discord.Client = new Discord.Client();

let store = new Map<string,Map<string,Discord.GuildChannel|Discord.Role>>();

let polls:Poll[];

export interface PollData {
  title?:string;
  body?:string;
  options?:Map<string,PollOption>;
  voteTally?:Map<string,PollOption>;
}
export interface PollUpdateOptions {
  title?:string,
  body?:string
}

export interface PollOption {
  title:string,
  body?:string
}

export class Poll {
  watchedMessages:{
    edit:Discord.Message,
    preview:Discord.Message
  };
  pollData:PollData;
  id:string;
  guildId:string;
  votingChannel:Discord.GuildChannel;

  constructor(guild_id:string,suppliedPollData?:PollData){
    if(typeof suppliedPollData === 'undefined'){
      suppliedPollData = {}
    }
    this.pollData = {
      title:suppliedPollData.title || 'Untitled Poll',
      body:suppliedPollData.body || 'This is where your description goes, you may use `!body` to update this',
      options:suppliedPollData.options || new Map<string,PollOption>()
    }
    this.guildId = guild_id;
    this.pollData.voteTally = new Map<string,PollOption>();

    this.watchedMessages = {
      edit:null,
      preview:null
    }

    this.id = uuidv4().substr(0,8);

    var manageChannel = store.get('channels').get('poll-management') as Discord.TextChannel;

    manageChannel.send({content:this.getPollText()}).then(message => this.watchedMessages.edit = message)
    manageChannel.send({content:Config.BotText.ManagePollFooterFooter()})
  }

  update(options:PollUpdateOptions){
    if(options.title){
      this.pollData.title = options.title
    }
    if(options.body){
      this.pollData.body = options.body
    }
    this.updateMessagePreview();
  }

  updateOption(emoji:string,body?:string){
    if(this.pollData.options.get(emoji) && !body){
      this.pollData.options.delete(emoji)
    }else{
      this.pollData.options.set(emoji,{title:emoji,body:body});
    }
    this.updateMessagePreview();
  }

  updateMessagePreview(){
    this.watchedMessages.edit.edit({content:this.getPollText()});
  }

  getPollText(): string{
    let outText = "__**"+this.pollData.title+"**__\n";
    outText += this.pollData.body;
    outText += "\n\n__**POLL OPTIONS**__\n"
    if(this.pollData.options.size === 0){
      outText += "use the command `!option :thumbsup: This mean you are voting 'yes'` to set up some emoji-based options\n"
      outText += "you can specify either an emoji `:emoji:` or any single word as the voting option (emojis will look prettier though)"
    }else{
      for (let [emoji,optionData] of this.pollData.options){
        outText += "\n`!vote "+emoji+"` -> "+optionData.body+ "\n"
      }
    }
    return outText;
  }

  async vote(voteMessage:Discord.Message){
    const voteSplit = voteMessage.content.split(" ")
    const voteOption = this.pollData.options.get(voteSplit[1])
    if(voteOption){
      this.pollData.voteTally.set(voteMessage.author.id,voteOption);
      voteMessage.react(':ballot_box:');
      voteMessage.delete({timeout:10000,reason:"vote tallied"})
    }else{
      const invalidMessage = await voteMessage.reply('invalid option, try copy/pasting the command directly above. Deleting in 10 secs')
      invalidMessage.delete({timeout:10000,reason:"invalid vote response"}); 
      voteMessage.react(':no_entry_sign:');
      voteMessage.delete({timeout:10000,reason:"invalid vote"})
    }
  }

  async withdraw(voteMessage:Discord.Message){
    const voteSplit = voteMessage.content.split(" ")
    this.pollData.voteTally.delete(voteMessage.author.id);
    //voteMessage.react(new Discord.Emoji(client,':ballot_box_with_check:'));
    voteMessage.delete({timeout:10000,reason:"vote removed"})
  }

  async start(){
    const guild = client.guilds.resolve(this.guildId);

    const roles = store.get('roles') as Map<string,Discord.Role>;
    var overwrites = ([
      {id:guild.id,allow:0,deny:FLAGS.ALL_TEXT},
      {id:roles.get('Gerousia').id,allow:FLAGS.ALL_TEXT},
      {id:roles.get('Spartiates').id,allow:FLAGS.VOTING,deny:FLAGS.ALL_TEXT}
    ]);

    const votingChannel = await guild.channels.create(this.pollData.title,{
      parent:store.get('channels').get('parent') as Discord.GuildChannel,
      permissionOverwrites:overwrites
    });

    await votingChannel.overwritePermissions(overwrites);
    store.get('channels').set(this.id,votingChannel);
    votingChannel.send(this.getPollText())
    votingChannel.send("Please vote by entering `!vote :vote-emoji:` corresponding to the options above (you can copy/paste from the options list)")
    votingChannel.send("You may change your vote by re-entering a command, but you must wait 5 minutes before changing")
    votingChannel.send("Withdraw your vote with `!withdraw`")

    store.get('channels').get('results');
    

    this.votingChannel = votingChannel;
  }
}

async function initializeConfig(type:string,iManager:Discord.GuildChannelManager|Discord.RoleManager,iConfig:Map<string,CreateData>){
  const iStore = store.get(type);
  console.log('iStore')

  //initialize keys to the store
  for(let [name,data] of iConfig){
    iStore.set(name,null);
  }

  //retrieve values from Manager cache, if found
  iManager.cache.forEach((guildObj:Discord.GuildChannel|Discord.Role)=>{
    if(iStore.has(guildObj.name)){
      console.log('found existing: '+guildObj.name)
      iStore.set(guildObj.name,guildObj);
    }
  })

  //create if not found
  for (let [name,data] of iConfig){
    if(iStore.get(name) === null){
      //separate functionality for Role vs. Channel since discord API has 2 different create functions
      switch (type) {
        case 'channels':
          const channelManager = iManager as Discord.GuildChannelManager;
          console.log('create new Channel: #'+name);
          let newChannelData = {
            ...data, 
            parent:iStore.get('parent'),
            permissionOverwrites:[{id:channelManager.guild.id,allow:0,deny:FLAGS.ALL_TEXT}]
          } as Discord.GuildCreateChannelOptions;

          let newChannel = await channelManager.create(name,newChannelData);
          iStore.set(name,newChannel);
          break;
        case 'roles':
          const roleManager = iManager as Discord.RoleManager;
          console.log('create new Role: '+name);
          let newRole = await roleManager.create(data)
          iStore.set(name,newRole);
          break;
        default:
          console.log('something went super wrong, mate');
      }
    }
  }

  console.log('\n== initialization complete ==')
  //console.log(iStore);

}

async function updatePermissions(){
  for (let [name,channel] of store.get('channels') as Map<string,Discord.GuildChannel>){
    switch(name){
      case 'poll-results':
      case 'poll-management':
        await channel.overwritePermissions(Config.Channels.get(name).getPermissionOverwrites(channel.guild,store.get('roles') as Map<string,Discord.Role>));
        break;
      case 'Apella':
        //nothing for now
        break;
    }
  }
  
}


export async function init(suppliedClient:Discord.Client){
  //initialize empty store
  store.set('channels',new Map<string,Discord.GuildChannel>())
  store.set('roles',new Map<string,Discord.Role>())

  //initialize empty polls
  polls = new Array<Poll>();

  //save client
  client = suppliedClient;

  //process setup for every guild - TODO: support multiple guilds
  client.guilds.cache.forEach(async function (guild:Discord.Guild,key:string){
    console.log(guild.emojis)
    //initialize Roles
    await initializeConfig('roles',guild.roles,Config.Roles);

    //initialize parent category for poll channel organization - TODO: support multiple Categories
    let foundCategory = [...guild.channels.cache.values()].find(({name}) => name === 'Apella')
    if(!foundCategory){
      foundCategory = await guild.channels.create('Apella',Config.Categories.get('Apella') as Discord.GuildCreateChannelOptions)
    }
    console.log(foundCategory)
    store.get('channels').set('parent',foundCategory);

    //initialize default polling channels
    await initializeConfig('channels',guild.channels,Config.Channels);

    await updatePermissions();
    
  })
}

export function processCommand(suppliedMessage:Discord.Message){
  const commandSplit = suppliedMessage.content.substr(1).split(' ')
  const command = suppliedMessage.content.substr(1).split(' ')[0];
  console.log('received command: '+command)
  switch(command){
    case 'help':
      suppliedMessage.reply('OK you got me, I havent finished this part yet!');
      break;
    case 'create':
      polls.push(new Poll(suppliedMessage.guild.id))
      break;
    case 'title':
      polls[0].update({title:suppliedMessage.content.substr(6)})
      break;
    case 'body':
      polls[0].update({body:suppliedMessage.content.substr(5)});
      break;
    case 'option':
      polls[0].updateOption(commandSplit[1],commandSplit.slice(2).join(" "));
      break;
    case 'start':
      polls[0].start();
      break;
    case 'vote':
      polls[0].vote(suppliedMessage);
      break;
    case 'withdraw':
      polls[0].withdraw(suppliedMessage);
      break;
  }
}