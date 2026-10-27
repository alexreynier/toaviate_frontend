// Members hub — the one header + tab bar shared by Members, Requests,
// Instructors and Missing Students. The four screens are CHILD states of
// dashboard.manage_club.members_hub (declared with `parent:` so their
// names, URLs, controllers and data are unchanged); only the nested
// <ui-view> swaps, so the chrome never re-renders and the width is stable.
app.controller('MembersHubController', MembersHubController);
MembersHubController.$inject = ['$state'];
function MembersHubController($state) {
    var hub = this;
    hub.state = $state;
    // Title / subtitle / icon come from the active child's data.hub.
    hub.meta = function(){
        var d = $state.current && $state.current.data;
        return (d && d.hub) || { title: 'Members', subtitle: 'Manage your club members', icon: 'fa-users' };
    };
    hub.isMembers = function(){ return $state.includes('dashboard.manage_club.members'); };
}
