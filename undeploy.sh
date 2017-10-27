#!/bin/bash

# uninstall
echo "Removing action"
bx wsk action delete detacher/detach

echo "Removing package"
bx wsk package delete detacher

echo "Removing rule"
bx wsk rule delete detacherRule --disable

echo "Removing Trigger"
bx wsk trigger delete detacherTrigger