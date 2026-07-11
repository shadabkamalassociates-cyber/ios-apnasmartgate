require 'xcodeproj'
project_path = 'ios/kamalSociety.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.first

# Remove old mygate references
project.files.select { |f| f.path =~ /mygate\.(mp3|wav|caf)/ }.each do |file|
  target.resources_build_phase.remove_file_reference(file)
  file.remove_from_project
end

# Add new mygate.caf
group = project.main_group.find_subpath('kamalSociety', true)
file_ref = group.new_reference('mygate.caf')
target.resources_build_phase.add_file_reference(file_ref, true)

project.save
