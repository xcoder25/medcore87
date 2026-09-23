import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
const CHECKLIST = [
  { id:'1', item:'Discharge summary signed', done:true },
  { id:'2', item:'Medications reconciled & TTO ready', done:true },
  { id:'3', item:'Follow-up appointment booked', done:false },
  { id:'4', item:'Patient education given', done:true },
  { id:'5', item:'Transport arranged', done:false },
  { id:'6', item:'GP letter sent', done:false },
];
export const DischargeADT: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<'discharge'|'beds'>('discharge');
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <Text style={s.pageTitle}>Discharge & ADT</Text><Text style={s.pageSub}>Admission · Discharge · Transfer · Bed board</Text>
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab==='discharge'&&s.tabOn]} onPress={()=>setTab('discharge')}><Text style={[s.tabText, tab==='discharge'&&s.tabTextOn]}>Discharge</Text></TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab==='beds'&&s.tabOn]} onPress={()=>setTab('beds')}><Text style={[s.tabText, tab==='beds'&&s.tabTextOn]}>Bed Board</Text></TouchableOpacity>
      </View>
      {tab==='discharge' ? (
        <>
          <View style={s.card}><Text style={s.cardTitle}>Margaret Taylor · Bed 5A</Text><Text style={s.meta}>Planned discharge today</Text>
            {CHECKLIST.map(c=>(
              <View key={c.id} style={s.checkRow}>
                <Text style={c.done?s.checkDone:s.checkPending}>{c.done?'✓':'○'}</Text>
                <Text style={[s.checkItem, c.done&&s.checkItemDone]}>{c.item}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.btn}><Text style={s.btnText}>Complete Discharge</Text></TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.cardTitle}>Ward 4-West Bed Board</Text>
          {[
            {bed:'4A', status:'Empty', patient:''}, {bed:'4B', status:'Occupied', patient:'R. Chen · NSTEMI'},
            {bed:'5A', status:'Discharge Today', patient:'M. Taylor · CHF'}, {bed:'5B', status:'Occupied', patient:'—'},
            {bed:'6C', status:'Occupied', patient:'A. Okonkwo · Post-CABG'}, {bed:'7A', status:'Occupied', patient:'J. Okafor · Angina'},
          ].map((b,i)=>(
            <View key={i} style={s.bedRow}>
              <Text style={s.bedNum}>{b.bed}</Text>
              <View style={{flex:1}}><Text style={s.bedStatus}>{b.status}</Text>{!!b.patient && <Text style={s.bedPatient}>{b.patient}</Text>}</View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:14,marginTop:2},
  tabs:{flexDirection:'row',gap:8,marginBottom:16}, tab:{paddingHorizontal:16,paddingVertical:8,borderRadius:20,backgroundColor:'#E2E8F0'}, tabOn:{backgroundColor:C.primary},
  tabText:{fontSize:13,fontWeight:'600',color:'#475569'}, tabTextOn:{color:'#FFF'},
  card:{backgroundColor:C.card,borderRadius:16,padding:16,marginBottom:14,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  cardTitle:{fontSize:15,fontWeight:'700',color:C.text,marginBottom:4}, meta:{fontSize:12,color:C.muted,marginBottom:12},
  checkRow:{flexDirection:'row',alignItems:'center',marginBottom:10}, checkDone:{fontSize:16,color:'#059669',marginRight:10}, checkPending:{fontSize:16,color:'#94A3B8',marginRight:10},
  checkItem:{fontSize:14,color:C.text}, checkItemDone:{color:C.muted,textDecorationLine:'line-through'},
  btn:{marginTop:12,backgroundColor:C.teal,borderRadius:12,paddingVertical:13,alignItems:'center'}, btnText:{color:'#FFF',fontWeight:'700',fontSize:14},
  bedRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F1F5F9'}, bedNum:{fontSize:14,fontWeight:'800',color:C.primary,width:40},
  bedStatus:{fontSize:13,fontWeight:'600',color:C.text}, bedPatient:{fontSize:12,color:C.muted,marginTop:1},
});
