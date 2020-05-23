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
  "voterAccountAge":2764800000,
  "getDenyAllOverwrite":(id:string)=> [{id:id,deny:FLAGS.ALL_TEXT}] as Discord.OverwriteResolvable[],
  "Roles": new Map<string,CreateData>([
    [
      "Spartiates",
      {
        "data":{
          "name":"Spartiates",
          "mention":false
        } as Discord.RoleData,
        "reason":"Voting class. Able to participate in governance."
      }
    ],
    [
      "Gerousia",
      {
        "data":{
          "name":"Gerousia",
          "mention":false
        } as Discord.RoleData,
        "reason":"Council for creating and managing polls."
      }
    ]
  ]),
  "Categories": new Map<string,CreateData>([
    [
      "Apella",
      {
        "name":"Apella",
        "type":"category",
        "reason":"Category for organizing all channels related to polling."
      }
    ]
  ]),
  "Channels": new Map<string,CreateData>([
    [
      "poll-management",
      {
        "name":"poll-management",
        "type":"text",
        "reason":"Allows for creation/management of polls",
        "topic":"Welcome to the poll-management channel, use `!help` for more information :)",
        "getPermissionOverwrites":(guild, roleStore): Discord.OverwriteResolvable[] =>{
          //let permissions:Discord.OverwriteResolvable[];

          return [
            {id:guild.id,deny:FLAGS.ALL_TEXT},
            {id:roleStore.get('Gerousia').id,allow:FLAGS.ALL_TEXT},
          ]
        }
      }
    ],
    [
      "poll-results",
      {
        "name":"poll-results",
        "type":"text",
        "topic":"\nChannel to display polling results polls.  For more information on the name \"Apella\" see https://en.wikipedia.org/wiki/Apella",
        "reason":"Display results from polls",
        "getPermissionOverwrites":(guild, roleStore): Discord.OverwriteResolvable[] =>{
          //let permissions:Discord.OverwriteResolvable[];
          return [
            {id:guild.id,allow:FLAGS.READ_ONLY,deny:FLAGS.ALL_TEXT},
            {id:roleStore.get('Gerousia').id,allow:FLAGS.ALL_TEXT},
          ]
        }
      }
    ]
  ])
};