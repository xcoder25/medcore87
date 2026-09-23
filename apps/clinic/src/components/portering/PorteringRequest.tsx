import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B', border:'#E2E8F0' };
const REQUESTS = [
  { id:'1', from:'Ward 4-West', to:'Radiology', patient:'Robert Chen', type:'Wheelchair', status:'In Progress', time:'11:05' },
  { id:'2', from:'Ward 4-West', to:'Pharmacy', patient:'—', type:'Specimen / Drugs', status:'Completed', time:'09:40' },
  { id:'3', from:'ED', to:'Ward 4-West', patient:'New admission', type:'Trolley', status:'Pending', time:'11:35' },
];
export const PorteringRequest: React.FC<Props> = ({ onBack }) => {
  const [showNew, setShowNew] = useState(false);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <View style={s.head}><View><Text style={s.pageTitle}>Portering & Transport</Text><Text style={s.pageSub}>Patient & specimen transport requests</Text></View>
        <TouchableOpacity style={s.newBtn} onPress={()=>setShowNew(!showNew)}><Text style={s.newBtnText}>{showNew?'Cancel':'+ Request'}</Text></TouchableOpacity></View>
      {showNew && <View style={s.newCard}>
        <TextInput style={s.input} placeholder="From location" placeholderTextColor="#94A3B8" />
        <TextInput style={s.input} placeholder="To location" placeholderTextColor="#94A3B8" />
        <TextInput style={s.input} placeholder="Patient / Bed (if applicable)" placeholderTextColor="#94A3B8" />
        <View style={s.typeRow}>{['Wheelchair','Trolley','Bed','Specimen'].map(t=><TouchableOpacity key={t} style={s.chip}><Text style={s.chipText}>{t}</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={s.submit}><Text style={s.submitText}>Submit Request</Text></TouchableOpacity>
      </View>}
      {REQUESTS.map(r=>(
        <View key={r.id} style={s.card}>
          <View style={s.top}><Text style={s.route}>{r.from} → {r.to}</Text>
            <View style={[s.status, r.status==='In Progress'?s.prog:r.status==='Pending'?s.pend:s.comp]}><Text style={s.statusText}>{r.status}</Text></View></View>
          <Text style={s.meta}>{r.patient} · {r.type} · {r.time}</Text>
        </View>
      ))}
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  head:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginTop:2},
  newBtn:{backgroundColor:C.primary,paddingHorizontal:14,paddingVertical:8,borderRadius:10}, newBtnText:{color:'#FFF',fontWeight:'700',fontSize:13},
  newCard:{backgroundColor:C.card,borderRadius:16,padding:16,marginBottom:16,borderWidth:1,borderColor:'#BFDBFE'},
  input:{backgroundColor:'#F8FAFC',borderWidth:1,borderColor:C.border,borderRadius:10,paddingHorizontal:12,paddingVertical:10,fontSize:14,marginBottom:10,color:C.text},
  typeRow:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:10}, chip:{backgroundColor:'#E0F2FE',paddingHorizontal:12,paddingVertical:6,borderRadius:20}, chipText:{fontSize:12,fontWeight:'600',color:'#0369A1'},
  submit:{backgroundColor:C.teal,borderRadius:10,paddingVertical:12,alignItems:'center'}, submitText:{color:'#FFF',fontWeight:'700',fontSize:14},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  top:{flexDirection:'row',justifyContent:'space-between',marginBottom:4}, route:{fontSize:14,fontWeight:'700',color:C.text,flex:1},
  status:{paddingHorizontal:8,paddingVertical:3,borderRadius:6}, prog:{backgroundColor:'#DBEAFE'}, pend:{backgroundColor:'#FEF3C7'}, comp:{backgroundColor:'#D1FAE5'},
  statusText:{fontSize:10,fontWeight:'800',color:C.text}, meta:{fontSize:12,color:C.muted,marginTop:2},
});
