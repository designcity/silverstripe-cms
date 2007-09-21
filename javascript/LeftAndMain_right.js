
CMSForm = Class.extend('ChangeTracker').extend('Observable');
CMSForm.prototype = {
	initialize : function(fn) {
		this.ChangeTracker.initialize();
		this.formName = fn;
		this.prepareForm();
	},
	
	/**
	 * Processing called whenever a page is loaded in the right - including the initial one
	 */
	prepareForm : function() {
		ajaxActionsAtTop(this.id, 'form_actions_' + this.formName, this.formName);
	},
	
	/**
	 * Load actions from a string containing the HTML content
	 */
	loadActionsFromString : function(actionHTML) {
		var actionHolder = $('form_actions_' + this.formName);
		actionHolder.innerHTML = actionHTML;
		prepareAjaxActions(actionHolder, this.id, this.formName);
	},

	/**
	 * Close the form down without any corrective action, after its been deleted.
	 */
	closeIfSetTo: function(id) {
		if(this.elements.ID && this.elements.ID.value == id) {
			this.innerHTML = "<p>This page was deleted.  To edit a page, select it from the left.</p>";
			if(typeof tinyMCE != 'undefined') tinyMCE.instances = [];
		}			
	},

	/**
	 * Reload lose the form if the current page is open.
	 */
	reloadIfSetTo: function(id) {
		if(this.elements.ID && this.elements.ID.value == id) {
			this.getPageFromServer(id);
		}			
	},
	
	close: function() {
		this.innerHTML = "<p>&#160;</p>";
		var actions;
		if(actions = $('form_actions_' + this.formName)) {
			actions.parentNode.removeChild(actions);
		}
	},
	
	updateStatus: function( newStatus ) {
		
		if( $('Form_EditForm_Status') )
			$('Form_EditForm_Status').innerHTML = "STATUS: " + newStatus;
	},

	/**
	 * Load a new page into the right-hand form.
	 * 
	 * @param formContent string
	 * @param response object (optional)
	 * @param evalResponse boolean (optional)
	 */
	loadNewPage : function(formContent, response, evalResponse) {
		//alert('here: ' + formContent);
		var rightHTML = formContent;
		
		// Rewrite # links
		rightHTML = rightHTML.replace(/href *= *"#/g, 'href="' + window.location.href.replace(/#.*$/,'') + '#');
		
		// Rewrite iframe links (for IE)
		rightHTML = rightHTML.replace(/(<iframe[^>]*src=")([^"]+)("[^>]*>)/g, '$1' + baseHref() + '$2$3');

		// Prepare iframes for removal, otherwise we get loading bugs
		var i, allIframes = this.getElementsByTagName('iframe');
		if(allIframes) for(i=0;i<allIframes.length;i++) {
			allIframes[i].contentWindow.location.href = 'about:blank';
			allIframes[i].parentNode.removeChild(allIframes[i]);
		}

		if(response && evalResponse) {
			Ajax.Evaluator(response);
		} else {
			this.innerHTML = rightHTML;
		}
		
		// Get the form attributes from embedded fields
		var attr;
		
		for(attr in {'action':true  ,'method':true,'enctype':true,'name':true}) {
			if(this.elements['_form_' + attr]) {
				this[attr] = this.elements['_form_' + attr].value;
				this.elements['_form_' + attr].parentNode.removeChild(this.elements['_form_' + attr]);
			}
		}
		
		allIframes = this.getElementsByTagName('iframe');
		if(allIframes) for(i=0;i<allIframes.length;i++) {
			try {
				allIframes[i].contentWindow.location.href = allIframes[i].src;
			} catch(er) {alert(er.message);}
		}
		
		_TAB_DIVS_ON_PAGE = [];

		try {
			var tabs = document.getElementsBySelector('#' + this.id + ' ul.tabstrip');
		} catch(er) { /*alert('a: '+ er.message + '\n' + er.line);*/ }
		try {
			for(var i=0;i<tabs.length;i++) if(tabs[i].tagName) initTabstrip(tabs[i]);
		} catch(er) { /*alert('b: '+ er.message + '\n' + er.line);*/ }
		
		if((typeof tinyMCE != 'undefined') && tinyMCE.instances) {
			tinyMCE.instances = [];
			tinyMCE.isLoaded = false;
			tinyMCE.onLoad();
		}

		if(this.prepareForm) this.prepareForm();
		
		Behaviour.apply(this);

		if(this.resetElements) this.resetElements();
		
		window.ontabschanged();
	},
	/**
	 * Save the contens of the form, by submitting it and resetting is changed checker
	 * on success.
	 *
	 * @param publish boolean (optional) whether to publish in addition to saving
	 */
	save: function(ifChanged, callAfter, action, publish) {
		_AJAX_LOADING = true;
		if(typeof tinyMCE != 'undefined') tinyMCE.triggerSave();
		if(!action) action = "save";

		var __callAfter = callAfter;
		var __form = this;
		
		if(__form.notify) __form.notify('BeforeSave', __form.elements.ID.value);

		// validate if required
		if(this.validate && !this.validate()) {
			// TODO Automatically switch to the tab/position of the first error
			statusMessage("Validation failed.", "bad");
			return false;
		}
		
		var success = function(response) {
			Ajax.Evaluator(response);
			__form.resetElements();
			if(__callAfter) __callAfter();
			if(__form.notify) __form.notify('PageSaved', __form.elements.ID.value);
			_AJAX_LOADING = false;
		}
		
		if(ifChanged) {
			var data = this.serializeChangedFields('ID') + '&ajax=1&action_' + action + '=1';
		} else {
			var data = this.serializeAllFields() + '&ajax=1&action_' + action + '=1';
		}
		if(publish)
		{
			data += '&publish=1';
		}
		
		statusMessage("Saving...", null, true);
		new Ajax.Request(this.action, {
			method : this.method,
			postBody: data,
			onSuccess : success,
			onFailure : function(response) {
				errorMessage('Error saving content', response);
				_AJAX_LOADING = false;
			}
		});
	},
	
	loadPage_url : 'admin/getpage'
}

CMSRightForm = Class.extend('CMSForm');
CMSRightForm.prototype = {
	intialize: function() {
		this.CMSForm.initialize('right');
	},


	/**
	 * Load the given URL (with &ajax=1) into this form
	 */
	loadURLFromServer : function(url) {
		var urlParts = url.match( /ID=(\d+)/ );
		var id = urlParts ? urlParts[1] : null;
		
		if( !url.match( /^https?:\/\/.*/ ) )
			url = document.getElementsByTagName('base')[0].href + url;
		
		new Ajax.Request( url + '&ajax=1', {
			asynchronous : true,
			onSuccess : function( response ) {
				$('Form_EditForm').successfullyReceivedPage(response,id);
			},
			onFailure : function(response) { 
				alert(response.responseText);
				errorMessage('error loading page',response);
			}
		});
	},
	
	successfullyReceivedPage : function(response,pageID) {
		var loadingNode = $('sitetree').loadingNode;
		
		if( loadingNode && pageID && parseInt( $('sitetree').getIdxOf( loadingNode ) ) != pageID ) {
			return;
		}
			
		// must wait until the javascript has finished
		document.body.style.cursor = 'wait';
	
		this.loadNewPage(response.responseText);
		
		var subform;
		if(subform = $('Form_MemberForm')) subform.close();
		if(subform = $('Form_SubForm')) subform.close();
		
		if(this.elements.ID) {
			this.notify('PageLoaded', this.elements.ID.value);
		}
		
		if(this.receivingID) {			
			// Treenode might not exist if that part of the tree is closed
			var treeNode = loadingNode ? loadingNode : $('sitetree').getTreeNodeByIdx(this.receivingID);
			if(treeNode) {
				$('sitetree').setCurrentByIdx(treeNode.getIdx());
				treeNode.removeNodeClass('loading');
			}
			statusMessage('');
		}
		
		// must wait until the javascript has finished
		document.body.style.cursor = 'default';
		
	},
	didntReceivePage : function(response) {
		errorMessage('error loading page', response); 
		$('sitetree').getTreeNodeByIdx(this.elements.ID.value).removeNodeClass('loading');
	},
			
	
	/**
	 * Request a page from the server via Ajax
	 */
	getPageFromServer : function(id, treeNode) {
		// if(id && id.match(/^[A-Za-z0-9_]+$/)) {
		if(id && (id == 'root' || parseInt(id) == id || (id.substr && id.substr(0,3) == 'new') )) {
			this.receivingID = id;

			// Treenode might not exist if that part of the tree is closed
			if(!treeNode) treeNode = $('sitetree').getTreeNodeByIdx(id);
			
			if(treeNode) {
				$('sitetree').loadingNode = treeNode;
				treeNode.addNodeClass('loading');
				url = treeNode.aTag.href + (treeNode.aTag.href.indexOf('?')==-1?'?':'&') + 'ajax=1';
			}
			if(SiteTreeHandlers.loadPage_url) {
				var sep = (SiteTreeHandlers.loadPage_url.indexOf('?') == -1) ? '?' : '&';
				url = SiteTreeHandlers.loadPage_url + sep + 'ID=' + id;
			}

			statusMessage("loading...");
			this.loadURLFromServer(url);
		} else {
			throw("getPageFromServer: Bad page ID: " + id);
		}
	},
	
	/**
	 * Set the status field
	 */
	setStatus: function(newStatus) {
		var statusLabel = document.getElementsBySelector('label.pageStatusMessage')[0];
		if(statusLabel) statusLabel.innerHTML = "STATUS: " + newStatus;		
	}
}

CMSForm.applyTo('#Form_SubForm', 'rightbottom');
CMSRightForm.applyTo('#Form_EditForm', 'right');


function action_save_right() {
	_AJAX_LOADING = true;
	$('Form_EditForm').save(false);
}


ActionPropertiesForm = Class.create();
ActionPropertiesForm.prototype = {
	/**
	 * Open the form
	 */
	 
	open : function() {
		var allInputs = this.getElementsByTagName('input');
		this.submitButton = allInputs[allInputs.length-1];
		this.submitButton.onclick = this.send.bind(this);
		this.style.display = '';
		
		// This detects whether we've opened a new page
		if($('Form_EditForm').elements.ID.value != this.elements.ID.value) {
			this.elements.ID.value = $('Form_EditForm').elements.ID.value;
			
			new Ajax.Updater(
				'action_submit_options_recipient',
				'admin/getpagemembers/' + this.elements.ID.value + '?SecurityLevel=' + this.securityLevel
			);				
		}
	},
	close : function() {
		this.style.display = 'none';
	},
	toggle : function() {
		if(this.style.display == '') this.close();
		else this.open();
	},
	
	/**
	 * Submit the option form and carry out the action
	 */
	send : function() {
		// Show a "submitting..." box
		if(!this.sendingText) {
			this.sendingText = document.createElement('div');
			this.sendingText.innerHTML = 'Submitting...';
			this.sendingText.className = 'sendingText';
			Element.setOpacity(this.sendingText, 0.9);
			this.appendChild(this.sendingText);
		}
		this.sendingText.style.display = '';
		
		// Send the request
		var buttons = document.getElementsBySelector('#' + this.id + ' p.Actions input');
		var actionButton = null;
		
		if( buttons )
			actionButton = buttons[0];
		ajaxSubmitForm(false, this.onComplete.bind(this), this, actionButton ? actionButton.name : '', 'submit');
		
		return false;
	},

	/**
	 * Process the action's Ajax response
	 */
	onComplete: function() {
		this.sendingText.style.display = 'none';
		if(this.elements.Message) this.elements.Message.value = '';
		this.close();
		$('Form_EditForm').getPageFromServer($('Form_EditForm_ID').value);
	}		
}



/**
 * Handle auto-saving.  Detects if changes have been made, and if so save everything on the page.
 * If confirmation is true it will ask for confirmation.
 */
function autoSave(confirmation, callAfter) {
	if(typeof tinyMCE != 'undefined') tinyMCE.triggerSave();

	var __forms = []
	if($('Form_EditForm')) __forms.push($('Form_EditForm'));
	if($('Form_SubForm')) __forms.push($('Form_SubForm'));
	if($('Form_MemberForm')) __forms.push($('Form_MemberForm'));
	
	var __somethingHasChanged = false;
	var __callAfter = callAfter;
	
	__forms.each(function(form) {
		if(form.isChanged && form.isChanged()) {
			__somethingHasChanged = true;
		}
	});
	
	if(__somethingHasChanged) {
		var options = {
			save: function() {
				statusMessage('saving...', '', true);
				var i;
				for(i=0;i<__forms.length;i++) {
					if(__forms[i].isChanged && __forms[i].isChanged()) {
						if(i == 0) __forms[i].save(true, __callAfter);
						else __forms[i].save(true);
					}
				}
			},
			discard: function() {
				__forms.each(function(form) { form.resetElements(false); });
				if(__callAfter) __callAfter();
			},
			cancel: function() {
			}
		}
		
		/**
		 * Fix the modal dialog!
		 */
		if(confirmation ) doYouWantToSave(options);
		else options.save();

	} else {
		if(__callAfter) __callAfter();
	}
}


StageLink = Class.create();
StageLink.prototype = {
	initialize: function(getVars, urlField) {
		this.getVars = getVars;
		this.urlField = urlField;
		
		var boundNewPage = this.newPage.bind(this);
		
		$('Form_EditForm').observeMethod('PageLoaded', boundNewPage);
		$('Form_EditForm').observeMethod('PageSaved', boundNewPage);
		$('Form_EditForm').observeMethod('PagePublished', boundNewPage);
		$('Form_EditForm').observeMethod('PageUnpublished', boundNewPage);

		this.newPage();
	},
	newPage : function() {
		var linkField = $('Form_EditForm').elements[this.urlField];
		var linkVal = linkField ? linkField.value : null;
		if(linkVal) {
			if(this.id != 'viewArchivedSite') this.style.display = '';
			this.href = linkVal + this.getVars;
		} else {
			if(this.id != 'viewArchivedSite') this.style.display = 'none';
		}
	},
	onclick : function() {
		var w = window.open(this.href, windowName('site'));
		w.focus();
		return false;
	},
	baseURL : function() {
		return document.getElementsByTagName('base')[0].href;
	}
}

StageLink.applyTo('#viewStageSite', '?stage=Stage', 'StageURLSegment');
StageLink.applyTo('#viewLiveSite', '?stage=Live', 'LiveURLSegment');
StageLink.applyTo('#viewArchivedSite', '', 'URLSegment');

window.name = windowName('cms');

/**
 * Return a unique window name that contains the URL
 */
function windowName(suffix) {
	var base = document.getElementsByTagName('base')[0].href.replace('http://','').replace(/\//g,'_').replace(/\./g,'_');
	return base + suffix;
}