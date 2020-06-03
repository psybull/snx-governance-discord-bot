# Synthetix Governance Discord Bot

A bot leveraging the Discord API to help scale governance for the Synthetix Community

[Funded through a grant from the Synthetix GrantsDAO](https://github.com/Synthetixio/snx-grants-dao/blob/master/proposals/snx-governance-discord-bot.md)

# Requirements

- NodeJS 12.16.3 or later
- Typescript `tsc` available from the PATH
- A `token` belonging to a [registered Discord Bot](https://discord.com/developers/applications) with Admin privileges on the server

# Setup

1. Edit `config.json` and update the `{your Discord Bot token here}` with the token assigned to you from your [registered Discord bot](https://discord.com/developers/applications)
2. `npm install`
3. `npm run-script bot`

# Usage

The bot creates the [Apella](https://en.wikipedia.org/wiki/Spartiate), a category for managing text channels for voting, with 2 initial text channels `#poll-management` and `#poll-results` along with 2 roles, the [Gerousia](https://en.wikipedia.org/wiki/Gerousia) (the governance managers) and the Spartitiates (those with the ability to vote).

Geroisia will have access to the `#poll-management`, where they have to following user flow:

1. `!create` - create a blank new poll
2. Edit the poll data:
  * `!title Example Poll` - change the title to given title
  * `!body Do you like this example poll?` - change the body to the given text (supports Discord markdown)
  * `!option :thumbsup: Yes, I love it!` - add a vote option, :thumbsup:, with the option description as given text (also supports Discord markdown)
  * `!option :thumbsdown: No, it stinks!` - add another vote option, similar to above
3. `!start` - publish poll and open for voting

Once the poll is `!start`-ed, the bot will create a new text channel with the prompt, which will be visible to all Spartiates.  Votes are cast in that channel with the `!vote :option:` command, and all options will be copy/pastable from the prompt.  The bot should be cleaning up messages after 10 seconds, to reduce clutter.  Anyone may change their vote by voting for a different option, or withdraw their vote with `!withdraw`.

The bot will create a message in the `#poll-results` channel, formatted to display the live vote results, which will update on each vote received

Finally, at the end of the vote, a Geroisia can use the `!end`, which will remove the voting channel and stop listening for new votes.  The results message in `#poll-results` will then stay as-is

### Multiple Polls

Upon poll creation, the bot assigns each poll an ID.  As a handy shortcut, if commands are issues without an ID, the bot will always assume the *oldest open* poll (inc. created/started, excl. ended) is the target of the command.  Any command can be given in the form of `!command *poll_id* Normal Command Options` to specify the poll, allowing multiple polls to be created/started/ended at once.

NOTE: the choice to manage the polls in one communal channel was explicit to allow collaboration as well as shared poll-administration, but can easily be updated to work through a more siloed method such as DM