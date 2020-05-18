import * as Discord from 'discord.js';

export const FLAGS = {
  ALL_TEXT:523328,
  VOTING:330752,
  READ_ONLY:66624
}

export interface CreateData {
  name?:string,
  data?:Discord.RoleData,
  reason?:string,
  type?:string,
  topic?:string,
  getPermissionOverwrites?:(guild:Discord.Guild,roleStore:Map<string,Discord.Role>) => Discord.OverwriteResolvable[]
}

export const Config = {
  "getDenyAllOverwrite":(id:string)=> [{id:id,deny:FLAGS.ALL_TEXT}] as Discord.OverwriteResolvable[],
  "Roles": new Map<string,CreateData>([
    [
      "voter",
      {
        "data":{
          "name":"voter",
          "mention":false
        } as Discord.RoleData,
        "reason":"Allows voting in the bot-managed polls"
      }
    ],
    [
      "poll-manager",
      {
        "data":{
          "name":"poll-manager",
          "mention":false
        } as Discord.RoleData,
        "reason":"Allows creation and management of polls"
      }
    ]
  ]),
  "Categories": new Map<string,CreateData>([
    [
      "polling",
      {
        "name":"polling",
        "type":"category",
        "reason":"Category for organizing channels related to polling"
      }
    ]
  ]),
  "Channels": new Map<string,CreateData>([
    [
      "management",
      {
        "name":"management",
        "type":"text",
        "reason":"Allows for creation/management of polls",
        "topic":"Welcome to the poll-management channel, use `!help` for more information :)",
        "getPermissionOverwrites":(guild, roleStore): Discord.OverwriteResolvable[] =>{
          //let permissions:Discord.OverwriteResolvable[];

          return [
            {id:guild.id,deny:FLAGS.ALL_TEXT},
            {id:roleStore.get('poll-manager').id,allow:FLAGS.ALL_TEXT},
          ]
        }
      }
    ],
    [
      "results",
      {
        "name":"results",
        "type":"text",
        "topic":"Channel to display the results from our latest polls",
        "reason":"Display results from polls",
        "getPermissionOverwrites":(guild, roleStore): Discord.OverwriteResolvable[] =>{
          //let permissions:Discord.OverwriteResolvable[];
          return [
            {id:guild.id,allow:FLAGS.READ_ONLY,deny:FLAGS.ALL_TEXT},
            {id:roleStore.get('poll-manager').id,allow:FLAGS.ALL_TEXT},
          ]
        }
      }
    ]
  ]),
  "BotText":{
    "ManagePollFooterFooter":():string=>{
      let msg = "\n";
         msg += "----------------------------------------\n";
         msg += "The above is a preview of your poll based on the data I have now.\n"
         msg += "To change the Title, use the command `!title My Snazzy New Title`\n"
         msg += "The Preview above should automatically update with your changes\n"
         msg += "A full list of commands can be found with the `!help` command\n"
         msg += "Feel free to delete this message!"

      return msg;
    }
      
  }
};