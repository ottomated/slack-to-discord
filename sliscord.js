var slackApi = require('slackbotapi');
var discordApi = require('discord.js');
var request = require('request');
var imgur = require('imgur');
var config = require('./config.json');
var slack = new slackApi({
    'token': config.slackToken,
    'logging': false,
    'autoReconnect': true
});
var discord = new discordApi.Client();
var guild;

slack.on('hello', function () {
    console.log('\x1b[47m\x1b[30mSlack is ready!\x1b[0m');
});
String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
slack.on('message', function (data) {
    if (data.type !== 'message') return;
    if (data.reply_to !== undefined) return;
    if (data.subtype === 'message_changed' || data.subtype === 'message_deleted') return;
    let image = '';
    if (data.subtype === 'file_share') {
        data.text = data.text.indexOf('commented:') >= 0 ? data.text.substring(data.text.indexOf('commented:') + 11) : '';
        image = data.file;
    }
    if (slack.getChannel(data.channel) !== null) {
        let channelname = slack.getChannel(data.channel).name;
        let discordChan = guild.channels.find('name', channelname);
        if (discordChan === null) {
            guild.createChannel(channelname, 'text', {
                parent: guild.channels.get(config.discord.channels)
            }).then(c => {
                slackMessageToDiscord(c, slack.getUser(data.user), data.text, image);
                c.setTopic(data.channel);
            });
            return;
        }
        slackMessageToDiscord(discordChan, slack.getUser(data.user), data.text, image);
    }
    if (slack.getGroup(data.channel) !== null) {
        let channelname = slack.getGroup(data.channel).members.filter(m => m !== slack.slackData.self.id).map(m => slack.getUser(m).name).join('_').replace(/[^\w_]/g, '');
        let discordChan = guild.channels.find('name', channelname);
        if (discordChan == null) {
            guild.createChannel(channelname, 'text', {
                parent: guild.channels.get(config.discord.directMessages)
            }).then(c => {
                slackMessageToDiscord(c, slack.getUser(data.user), data.text, image);
                c.setTopic(data.channel);
            });
            return;
        }
        slackMessageToDiscord(discordChan, slack.getUser(data.user), data.text, image);
    }

    if (slack.getIM(data.channel) !== null) {

        let channelname = slack.getUser(slack.getIM(data.channel).user).name.replace(/[^\w_]/g, '');
        let discordChan = guild.channels.find('name', channelname);

        if (discordChan == null) {
            guild.createChannel(channelname, 'text', {
                parent: guild.channels.get(config.discord.directMessages)
            }).then(c => {
                slackMessageToDiscord(c, slack.getUser(data.user), data.text, image);
                c.setTopic(data.channel);
            });
            return;
        }
        slackMessageToDiscord(discordChan, slack.getUser(data.user), data.text, image);
    }


});

function slackMessageToDiscord(channel, user, text, file) {
    text = filterSlackMsg(text);
    var embed = {
        "color": 16737792,
        "author": {
            "name": user.name,
            "icon_url": user.profile.image_24
        },
        "fields": []
    };
    if (file !== '') {
        embed.fields.push({
            "name": 'Attachment',
            "value": `[${file.name}](${file.permalink})`
        })
    }
    if (text !== '') {
        embed.fields.push({
            "name": 'Message',
            "value": text
        });
    }
    channel.send({
        embed
    });

}

function filterSlackMsg(txt) {
    txt = txt.replace(/\<(https?.+)\>/i, '$1');
    txt = txt.replace('&gt;', '>');
    txt = txt.replace('&lt;', '<');
    //txt = txt.replace('**', '*');
    //var regex = /\<@(U[A-Z0-9]{8})(?:\|(\w+))?>/i.exec(txt);
    return txt;
}
discord.on('ready', () => {
    console.log('\x1b[47m\x1b[30mDiscord is ready!\x1b[0m');
    guild = discord.guilds.get(config.discord.guild);
});

discord.on('message', message => {
    if (message.guild !== guild) return;
    if (message.author == discord.user) return;
    if (message.channel.parent.id == config.discord.channels) {
        let chan = slack.getChannel(message.channel.topic);
        slack.sendMsg(chan.id, message.content);
        message.react('👍');
        const collector = message.createReactionCollector(
            (reaction, user) => false, {
                time: 2000
            }
        );
        collector.on('end', collected => message.clearReactions());
    } else if (message.channel.name.indexOf('_') === -1) {
        let chan = slack.getIM(message.channel.topic);
        slack.sendMsg(chan.id, message.content);
        message.react('👍');
        const collector = message.createReactionCollector(
            (reaction, user) => false, {
                time: 2000
            }
        );
        collector.on('end', collected => message.clearReactions());
    } else {
        let chan = slack.getGroup(message.channel.topic);
        slack.sendMsg(chan.id, message.content);
        message.react('👍');
        const collector = message.createReactionCollector(
            (reaction, user) => false, {
                time: 2000
            }
        );
        collector.on('end', collected => message.clearReactions());
    }
});

discord.login(config.discordToken);
