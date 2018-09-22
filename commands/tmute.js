exports.exec = async (client, message, args) => {
  try {
    let user;
    if (message.mentions.users.size) {
      user = message.mentions.users.first();
    }
    else if (args.id) {
      user = await client.fetchUser(args.id);
    }
    if (!user) {
      /**
       * The command was ran with invalid parameters.
       * @fires commandUsage
       */
      return client.emit('commandUsage', message, this.help);
    }

    let member = await message.guild.fetchMember(user.id);
    if (message.author.id !== message.guild.ownerID && message.member.highestRole.comparePositionTo(member.highestRole) <= 0) return client.log.info(client.i18n.error(message.guild.language, 'lowerRole'));

    args.reason = args.reason.join(' ');

    if (args.server) {
      let mutedRole = message.guild.roles.find('name', 'Muted');
      if (!mutedRole) {
        mutedRole = await message.guild.createRole({ name:'Muted' });
      }

      await member.addRole(mutedRole, args.reason);

      for (let channel of message.guild.channels.filter(channel => channel.type === 'text')) {
        channel = channel[1];
        if (!channel.permissionOverwrites.get(mutedRole.id)) {
          await channel.overwritePermissions(mutedRole, {
            SEND_MESSAGES: false,
            ADD_REACTIONS: false
          });
        }
      }

      if (args.timeout) {
        args.timeout = Math.abs(args.timeout);

        if (!args.timeout || args.timeout > 1440) args.timeout = 1440;

        client.setTimeout(async () => {
          try {
            await member.removeRole(mutedRole, 'User auto unmuted after timeout.');
          }
          catch (e) {
            client.log.error(e);
          }
        }, args.timeout * 60 * 1000);
      }
    }
    else {
      await message.channel.overwritePermissions(user, {
        SEND_MESSAGES: false,
        ADD_REACTIONS: false
      }, args.reason);

      if (args.timeout) {
        args.timeout = Math.abs(args.timeout);

        if (!args.timeout || args.timeout > 1440) args.timeout = 1440;

        client.setTimeout(async () => {
          try {
            let permissionOverwrites = message.channel.permissionOverwrites.get(user.id);
            if (permissionOverwrites) {
              await permissionOverwrites.delete();
            }
          }
          catch (e) {
            client.log.error(e);
          }
        }, args.timeout * 60 * 1000);
      }
    }

    message.channel.send({
      embed: {
        color: client.colors.ORANGE,
        description: `${message.author.tag} text-muted ${user.tag}${args.timeout ? ` for ${args.timeout} minutes ` : ' '}with reason **${args.reason}**`
      }
    }).catch(e => {
      client.log.error(e);
    });

    /**
     * Logs moderation events if it is enabled
     * @fires moderationLog
     */
    client.emit('moderationLog', message, this.help.name, user, args.reason, {
      channel: message.channel
    });
  }
  catch (e) {
    client.log.error(e);
  }
};

exports.config = {
  alias: [ 'tm' ],
  enabled: true,
  argsDefinitions: [
    { name: 'id', type: String, defaultOption: true },
    { name: 'reason', alias: 'r', type: String, multiple: true, defaultValue: [ 'No reason given.' ] },
    { name: 'server', type: Boolean, alias: 's' },
    { name: 'timeout', type: Number, alias: 't' }
  ]
};

exports.help = {
  name: 'textMute',
  description: 'Text mutes a specified user from the specified text channel (for specified minutes) or globally on your Discord server.',
  botPermission: 'MANAGE_ROLES',
  userTextPermission: 'MUTE_MEMBERS',
  userVoicePermission: '',
  usage: 'textMute < @USER_MENTION | USER_ID > [-r Reason] [--server] [-t MINUTES]',
  example: [ 'textMute @user#0001 -r off topic discussions -t 15', 'textMute 167147569575323761 -r misbehaving with others --server' ]
};