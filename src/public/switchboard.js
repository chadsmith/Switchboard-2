$(function(){
	var socket = new io.Socket();
	var action = {
		incoming: function(data){
			$('<div></div>').attr('id', data.sid).text(data.from).draggable({
				helper: 'clone'
			}).appendTo('#queue');
		},
		complete: function(data){
			$('#' + data.sid).remove();
		},
		transfer: function(data){
			$('#' + data.id).fadeOut();
			$('#' + data.sid).remove();
		},
		finished: function(data){
			$('#' + data.id).fadeIn();
		},
		add: function(data){
			$('<div></div>').attr('id', data.id).text(data.name)['busy' == data.status ? 'hide' : 'show']().addClass(data.status ? 'operator' : 'plugin').addClass(data.name.toLowerCase().replace(/\s/g, '-').replace(/[^\w\-]/g, '')).droppable({
				drop: function(event, ui){
					socket.send({ id: $(this).attr('id'), sid: ui.draggable.attr('id') });
				}
			}).appendTo('#plugins');
		},
		connect: function(data, i){
			for(i in data.queue)
				action.incoming(data.queue[i]);
			for(i in data.operators)
				action.add(data.operators[i]);
			for(i in data.plugins)
				action.add(data.plugins[i]);
		}
		
	};
	socket.connect();
	socket.on('message', function(data){
		if(data.action in action)
			return action[data.action](data);
	});
});
