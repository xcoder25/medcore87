import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B', border:'#E2E8F0' };
const REFS = [
  { id:'1', to:'Cardiology', patient:'Robert Chen', bed:'4B', reason:'Possible early stent thrombosis', status:'Accepted', time:'11:26' },
  { id:'2', to:'Physiotherapy', patient:'Aisha Okonkwo', bed:'6C', reason:'Post-CABG mobilisation', status:'Pending', time:'09:00' },
  { id:'3', to:'Dietetics', patient:'Margaret Taylor', bed:'5A', reason:'CHF diet education', status:'Completed', time:'Yesterday' },
];
export const Referrals: React.FC<Props> = ({ onBack }) => {
  const [showNew, setShowNew] = useState(false);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <View style={s.head}><View><Text style={s.pageTitle}>Referrals</Text><Text style={s.pageSub}>Internal & external referrals</Text></View>
        <TouchableOpacity style={s.newBtn} onPress={()=>setShowNew(!showNew)}><Text style={s.newBtnText}>{showNew?'Cancel':'+ Refer'}</Text></TouchableOpacity></View>
      {showNew && <View style={s.newCard}>
        <TextInput style={s.input} placeholder="Specialty / Service" placeholderTextColor="#94A3B8" />
        <TextInput style={s.input} placeholder="Patient / Bed" placeholderTextColor="#94A3B8" />
        <TextInput style={[s.input,{height:80,textAlignVertical:'top'}]} placeholder="Reason for referral" placeholderTextColor="#94A3B8" multiline />
        <TouchableOpacity style={s.submit}><Text style={s.submitText}>Send Referral</Text></TouchableOpacity>
      </View>}
      {REFS.map(r=>(
        <View key={r.id} style={s.card}>
          <View style={s.top}><Text style={s.to}>{r.to}</Text><View style={[s.status, r.status==='Accepted'?s.acc:r.status==='Pending'?s.pend:s.comp]}><Text style={s.statusText}>{r.status}</Text></View></View>
          <Text style={s.patient}>{r.patient} · Bed {r.bed}</Text>
          <Text style={s.reason}>{r.reason}</Text>
          <Text style={s.time}>{r.time}</Text>
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
  submit:{backgroundColor:C.teal,borderRadius:10,paddingVertical:12,alignItems:'center'}, submitText:{color:'#FFF',fontWeight:'700',fontSize:14},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  top:{flexDirection:'row',justifyContent:'space-between',marginBottom:4}, to:{fontSize:14,fontWeight:'800',color:C.primary},
  status:{paddingHorizontal:8,paddingVertical:3,borderRadius:6}, acc:{backgroundColor:'#D1FAE5'}, pend:{backgroundColor:'#FEF3C7'}, comp:{backgroundColor:'#F1F5F9'},
  statusText:{fontSize:10,fontWeight:'800',color:C.text}, patient:{fontSize:13,fontWeight:'600',color:C.text}, reason:{fontSize:13,color:'#334155',marginTop:4}, time:{fontSize:12,color:C.muted,marginTop:4},
});
