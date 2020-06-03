import * as Discord from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { GuildDataStore } from './VoteManager';
import { FLAGS } from './config';


export interface PollData {
  title?:string;
  body?:string;
  options?:Map<string,PollOption>;
  voteTally?:Map<string,PollOption>;
}

interface PollUpdateOptions {
  title?:string;
  body?:string;
}

interface PollOption {
  title:string;
  body?:string;
}

export enum PollStatus{create, run, end}

export interface ResultsData {
  voteTotalsByOption:Map<PollOption,number>;
  voterIdByOption:Map<PollOption,string[]>;
  totalVotes:number,
  winningTotal:number
}

export class Poll {
  id:string;
  //passed in from client
  client:Discord.Client;
  guildId:string;
  guildStore:GuildDataStore;

  //Messages the bot will create and update
  watchedMessages:{
    preview:Discord.Message,
    results:Discord.Message
  };
  
  pollData:PollData;
  results:ResultsData;

  status: PollStatus;
  
  //the temporary channel created to collect votes
  votingChannel:Discord.GuildChannel;
  

  constructor(suppliedClient:Discord.Client,guildId:string,guildDataStore:GuildDataStore,suppliedPollData?:PollData){
    this.client = suppliedClient;
    this.guildId = guildId;
    this.guildStore = guildDataStore;
    this.status = PollStatus.create;
    

    if(typeof suppliedPollData === 'undefined'){
      suppliedPollData = {}
    }
    this.pollData = {
      title:suppliedPollData.title || 'Untitled Poll',
      body:suppliedPollData.body || 'This is where your description goes, you may use `!body` to update this',
      options:suppliedPollData.options || new Map<string,PollOption>()
    }
    this.pollData.voteTally = new Map<string,PollOption>();

    this.watchedMessages = {
      preview:null,
      results:null
    }

    this.id = uuidv4().substr(0,6);

    let manageChannel = this.guildStore.channels.get('poll-management') as Discord.TextChannel;

    manageChannel.send({content:this.getPromptText()}).then(message => this.watchedMessages.preview = message)
    manageChannel.send({content:this.ManagePollFooterFooter()}).then(message => message.delete({timeout:20000}))
    
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

  delete(){
    if(this.watchedMessages.preview){
      this.watchedMessages.preview.delete({reason:'Poll was deleted manually'});
    }
    if(this.watchedMessages.results){
      this.watchedMessages.results.delete({reason:'Poll was deleted manually'});
    }
    if(this.votingChannel){
      this.votingChannel.delete('Poll was deleted manually');
    }
  }

  updateOption(title:string,body?:string){
    if(this.pollData.options.get(title) && !body){
      this.pollData.options.delete(title)
    }else{
      this.pollData.options.set(title,{title:title,body:body});
    }
    this.updateMessagePreview();
  }

  updateMessagePreview(){
    this.watchedMessages.preview.edit({content:this.getPromptText()});
  }

  getResultsData():ResultsData{
    let voteTotalsByOption = new Map<PollOption,number>();
    let voterIdByOption = new Map<PollOption,string[]>();

    

    for (let [optionName,option] of this.pollData.options){
      voteTotalsByOption.set(option,0);
      voterIdByOption.set(option,[]);
    }

    let maxVotes = 0;

    this.pollData.voteTally.forEach((option,voterId)=>{
      voteTotalsByOption.set(option,voteTotalsByOption.get(option) + 1);
      voterIdByOption.get(option).push(voterId);
      if(maxVotes < voteTotalsByOption.get(option)){ 
        maxVotes = voteTotalsByOption.get(option);
      }
    })

    return {
      voteTotalsByOption:voteTotalsByOption,
      voterIdByOption:voterIdByOption,
      totalVotes:this.pollData.voteTally.size,
      winningTotal:maxVotes
    }
  }

  getPromptText(): string{
    let outText = "__**"+this.pollData.title+"**__ - id: `"+this.id + "`\n";
    outText += this.pollData.body;
    outText += "\n\n__**POLL OPTIONS**__\n"
    if(this.pollData.options.size === 0){
      outText += "use the command `!option "+this.id+" :thumbsup: This mean you are voting 'yes'` to set up some poll options with descriptions\n"
      outText += "you can specify either an emoji `:emoji:` or any single word as the voting command"
    }else{
      for (let [emoji,optionData] of this.pollData.options){
        outText += "\n`  !vote "+emoji+"  ` -> "+optionData.body+ "\n"
      }
    }
    return outText;
  }

  async updateResultsMessage(){
    if(!this.watchedMessages.results){
      (this.guildStore.channels.get('poll-results') as Discord.TextChannel).send({content:this.getResultsText()}).then((msg)=>{this.watchedMessages.results=msg})
    }else{
      this.watchedMessages.results.edit({content:this.getResultsText()});
    }
  }

  getOptionResultsText(opt:PollOption): string{
    const RD = this.results;
    let outText = "`"+opt.title+" -> "+opt.body+ "`\n"
    outText += " - Votes: "+ RD.voteTotalsByOption.get(opt) + " (" + (RD.voteTotalsByOption.get(opt) / RD.totalVotes * 100).toFixed(2) + "%)\n"
    
    if(RD.voterIdByOption.get(opt).length > 0){
      outText += " - Supporters: \n```";
      outText += RD.voterIdByOption.get(opt).reduce((sumString,supporter)=>{
        if(sumString.length > 0){sumString += " "}
        return sumString + this.votingChannel.guild.members.cache.get(supporter).displayName;
      },"") + "```\n"
    }
    return outText;
  }

  getSortedPollResults(results:ResultsData):PollOption[]{
    return [...results.voteTotalsByOption.keys()].sort((l,r)=>{return (results.voteTotalsByOption.get(l) < results.voteTotalsByOption.get(r)) ? -1 : 1;}).reverse()
  }

  getResultsText(): string{
    let outText = "__**"+this.pollData.title+" - Results**__\n";
    outText += "Prompt:\n\n"
    outText += "\t "+ this.pollData.body+ "\n\n"

    const RD = this.getResultsData();

    let pollResults = this.getSortedPollResults(RD);

    outText += "Total Votes: "+RD.totalVotes+"\n";
    for(let i = 0; i < pollResults.length; i++){
      let opt = pollResults[i];
      let optResultLine = opt.title + " \t- " + RD.voteTotalsByOption.get(opt) + " (" + (RD.voteTotalsByOption.get(opt) / RD.totalVotes * 100).toFixed(2) + "%)"
      if(RD.voteTotalsByOption.get(opt) === RD.winningTotal){
        optResultLine = "**"+optResultLine+" (Winning)**"
      }
      outText += "\n"+ optResultLine; 
    }

    outText += "\n\n**Detailed Breakdown**\n"

    for (let opt of pollResults){
      outText += this.getOptionResultsText(opt);
    }

    return outText;
  }

  async vote(voteMessage:Discord.Message){
    const voteSplit = voteMessage.content.split(" ")
    const voteOption = this.pollData.options.get(voteSplit[1])
    if(voteOption){
      this.pollData.voteTally.set(voteMessage.author.id,voteOption);
      //voteMessage.react(':ballot_box:');
      voteMessage.delete({timeout:10000,reason:"vote tallied"})
    }else{
      const invalidMessage = await voteMessage.reply('invalid option, try copy/pasting the command directly above. Deleting in 10 secs')
      invalidMessage.delete({timeout:10000,reason:"invalid vote response"}); 
      //voteMessage.react(':no_entry_sign:');
      voteMessage.delete({timeout:10000,reason:"invalid vote"})
    }
    this.results = this.getResultsData();
    this.updateResultsMessage();
  }

  async withdraw(voteMessage:Discord.Message){
    const voteSplit = voteMessage.content.split(" ")
    this.pollData.voteTally.delete(voteMessage.author.id);
    //voteMessage.react(new Discord.Emoji(client,':ballot_box_with_check:'));
    this.updateResultsMessage();
    voteMessage.delete({timeout:10000,reason:"vote removed"})
  }

  async start(){
    var overwrites = ([
      {id:this.guildId,allow:0,deny:FLAGS.ALL_TEXT},
      {id:this.guildStore.roles.get('Gerousia').id,allow:FLAGS.ALL_TEXT},
      {id:this.guildStore.roles.get('Spartiates').id,allow:FLAGS.VOTING,deny:FLAGS.ALL_TEXT}
    ]);

    const votingChannel = await this.client.guilds.resolve(this.guildId).channels.create(this.pollData.title,{
      parent:this.guildStore.channels.get('parent') as Discord.GuildChannel,
      permissionOverwrites:overwrites
    });

    await votingChannel.overwritePermissions(overwrites);
    this.guildStore.channels.set(this.id,votingChannel);
    votingChannel.send(this.getPromptText())
    votingChannel.send("Please indicate your preference by entering `!vote :vote-emoji:` corresponding to the options above (copy/paste for accuracy)")
    votingChannel.send("`!withdraw` to cancel your vote")

    this.guildStore.channels.get('results');
    
    this.status = PollStatus.run;

    this.votingChannel = votingChannel;
  }

  async end(){
    this.updateResultsMessage();
    let reason = this.id + ' - poll has ended'
    this.votingChannel.delete(reason)
    this.watchedMessages.preview.delete({reason:reason})
    this.status = PollStatus.end;
  }

  
  ManagePollFooterFooter():string{
    let msg  = "\n";
        msg += "----------------------------------------\n";
        msg += "The above is a preview of your poll based on the data I have now.\n"
        msg += "To change the Title, use the command `!title My Snazzy New Title`\n"
        msg += "The Preview above should automatically update with your changes\n"
        msg += "A full list of commands can be found with the `!help` command\n"
        msg += "This message will self destruct in 20 seconds!"
    return msg;
  }
}